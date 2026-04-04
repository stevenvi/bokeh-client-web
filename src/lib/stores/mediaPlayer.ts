import { writable, get } from 'svelte/store';
import { listAlbumTracks, audioStreamUrl, albumCoverUrl } from '$lib/api/music';
import type { TrackView } from '$lib/types';

export interface AudioQueueItem {
	id: number;
	title: string;
	artistName: string | null;
	durationSeconds: number | null;
	mimeType: string;
	albumId: number;
	albumName: string;
}

export interface VideoPlayParams {
	itemId: number;
	title: string;
	collectionId: number;
	collectionName: string;
	collectionType: string;
	bookmarkSeconds: number | null;
	thumbnailUrl: string | null;
}

export interface MediaPlayerState {
	type: 'audio' | 'video' | null;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	visible: boolean;
	isFullPlayer: boolean;
	// Audio-only
	queue: AudioQueueItem[];
	queueIndex: number;
	shuffle: boolean;
	repeat: 'none' | 'one' | 'all';
	// Video-only (also used for display in audio mode)
	itemId: number | null;
	title: string;
	subtitle: string;
	thumbnailUrl: string | null;
	collectionId: number | null;
	collectionType: string | null;
	bookmarkSeconds: number | null;
}

const STORAGE_KEY = 'bokeh-media-player';

function loadSavedState(): Partial<MediaPlayerState> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			return {
				queue: parsed.queue ?? [],
				queueIndex: parsed.queueIndex ?? 0,
				currentTime: parsed.currentTime ?? 0,
				volume: parsed.volume ?? 1,
				shuffle: parsed.shuffle ?? false,
				repeat: parsed.repeat ?? 'none',
				visible: parsed.visible ?? false
			};
		}
	} catch {
		// ignore
	}
	return {};
}

function createMediaPlayerStore() {
	const saved = typeof localStorage !== 'undefined' ? loadSavedState() : {};
	const hasAudioQueue = (saved.queue?.length ?? 0) > 0;

	const { subscribe, update } = writable<MediaPlayerState>({
		type: hasAudioQueue ? 'audio' : null,
		isPlaying: false,
		currentTime: saved.currentTime ?? 0,
		duration: 0,
		volume: saved.volume ?? 1,
		visible: saved.visible ?? false,
		isFullPlayer: false,
		queue: saved.queue ?? [],
		queueIndex: saved.queueIndex ?? 0,
		shuffle: saved.shuffle ?? false,
		repeat: saved.repeat ?? 'none',
		itemId: null,
		title: '',
		subtitle: '',
		thumbnailUrl: null,
		collectionId: null,
		collectionType: null,
		bookmarkSeconds: null
	});

	// DOM element refs — set by MediaPlayer component on mount
	let audioEl: HTMLAudioElement | null = null;
	let videoEl: HTMLVideoElement | null = null;
	// Preloaded next audio for near-gapless transition
	let nextAudio: HTMLAudioElement | null = null;
	let lastPersistTime = 0;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let hlsInstance: any = null;
	// Artwork cache — keyed by albumId to avoid re-fetching within an album
	let artworkCache: { albumId: number; dataUrl: string } | null = null;

	function persist(state: MediaPlayerState) {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					queue: state.queue,
					queueIndex: state.queueIndex,
					currentTime: state.currentTime,
					volume: state.volume,
					shuffle: state.shuffle,
					repeat: state.repeat,
					visible: state.visible
				})
			);
		} catch {
			// ignore quota errors
		}
	}

	function setupAudioEvents() {
		if (!audioEl) return;
		audioEl.ontimeupdate = () => {
			if (!audioEl) return;
			update((s) => ({ ...s, currentTime: audioEl!.currentTime }));
			const now = Date.now();
			if (now - lastPersistTime >= 1000) {
				lastPersistTime = now;
				persist(get({ subscribe }));
			}
		};
		audioEl.onloadedmetadata = () => {
			if (!audioEl) return;
			update((s) => ({ ...s, duration: audioEl!.duration }));
			// Once the real duration is known, re-push the complete playing state.
			// The earlier setPositionState in setupMediaSession used an estimated
			// duration from queue metadata; this corrects it with the actual value,
			// and gives iOS the simultaneous playbackState + setPositionState update
			// it needs to render the lock screen as actively playing.
			if ('mediaSession' in navigator && !audioEl.paused) {
				navigator.mediaSession.playbackState = 'playing';
				navigator.mediaSession.setPositionState({
					duration: audioEl.duration,
					playbackRate: audioEl.playbackRate,
					position: audioEl.currentTime
				});
			}
		};
		audioEl.onended = () => {
			if (get({ subscribe }).type === 'audio') next();
		};
		audioEl.onerror = () => {
			if (get({ subscribe }).type === 'audio') next();
		};
		audioEl.onplay = () => {
			if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
		};
		audioEl.onpause = () => {
			// Do not update the OS playback state here. The 'pause' event fires
			// for track transitions (src change), buffering stalls, and seeks —
			// not just user-initiated pauses. Signalling 'paused' on every one
			// causes the play-pause-play flicker on the lock screen.
			// Explicit pause() and the OS action handler are the only paths that
			// should send 'paused' to the OS.
		};
	}

	function setupMediaSession(track: AudioQueueItem) {
		if (!('mediaSession' in navigator)) return;

		navigator.mediaSession.setActionHandler('play', () => play());
		navigator.mediaSession.setActionHandler('pause', () => pause());
		navigator.mediaSession.setActionHandler('previoustrack', () => previous());
		navigator.mediaSession.setActionHandler('nexttrack', () => next());
		navigator.mediaSession.setActionHandler('seekto', (d) => {
			if (d.seekTime != null) seekTo(d.seekTime);
		});

		if (track.durationSeconds) {
			navigator.mediaSession.setPositionState({
				duration: track.durationSeconds,
				playbackRate: 1,
				position: 0
			});
		}

		function applyMetadata(dataUrl: string | null) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: track.title,
				artist: track.artistName ?? '',
				album: track.albumName,
				artwork: dataUrl ? [{ src: dataUrl, sizes: '400x400' }] : []
			});
		}

		// If artwork for this album is already cached, apply it immediately —
		// no fetch, no flicker, no second metadata update.
		if (artworkCache?.albumId === track.albumId) {
			applyMetadata(artworkCache.dataUrl);
			return;
		}

		// No cached artwork yet — set metadata without artwork first so the
		// lock screen shows the track name immediately, then fetch and update.
		applyMetadata(null);

		const trackId = track.id;
		fetch(albumCoverUrl(track.albumId), { credentials: 'include' })
			.then((resp) => (resp.ok ? resp.blob() : null))
			.then((blob) => {
				if (!blob) return;
				const current = get({ subscribe });
				if (current.queue[current.queueIndex]?.id !== trackId) return;
				const reader = new FileReader();
				reader.onload = () => {
					const dataUrl = reader.result as string;
					if (!dataUrl) return;
					artworkCache = { albumId: track.albumId, dataUrl };
					// Re-check track is still current after the async read
					const stillCurrent = get({ subscribe });
					if (stillCurrent.queue[stillCurrent.queueIndex]?.id !== trackId) return;
					applyMetadata(dataUrl);
				};
				reader.readAsDataURL(blob);
			})
			.catch(() => {});
	}

	function preloadNextAudio() {
		const state = get({ subscribe });
		const nextIdx = state.queueIndex + 1;
		if (nextIdx < state.queue.length) {
			nextAudio = new Audio();
			nextAudio.crossOrigin = 'use-credentials';
			nextAudio.src = audioStreamUrl(state.queue[nextIdx].id);
			nextAudio.preload = 'auto';
		} else {
			nextAudio = null;
		}
	}

	function restoreAudioSession() {
		if (!audioEl) return;
		const state = get({ subscribe });
		const track = state.queue[state.queueIndex];
		if (!track) return;

		audioEl.volume = state.volume;
		audioEl.src = audioStreamUrl(track.id);
		const savedTime = state.currentTime;
		if (savedTime > 0) {
			audioEl.addEventListener(
				'loadedmetadata',
				() => {
					if (audioEl) audioEl.currentTime = savedTime;
				},
				{ once: true }
			);
		}
		setupMediaSession(track);
		preloadNextAudio();
	}

	function playCurrentAudioTrack() {
		if (!audioEl) return;
		const state = get({ subscribe });
		const track = state.queue[state.queueIndex];
		if (!track) return;

		audioEl.src = audioStreamUrl(track.id);
		audioEl.volume = state.volume;
		audioEl.play().catch(() => {});

		// Set isPlaying: true before setupMediaSession so that applyMetadata
		// reads the correct state when it checks isPlaying for playbackState.
		update((s) => ({
			...s,
			type: 'audio' as const,
			isPlaying: true,
			currentTime: 0,
			duration: 0,
			title: track.title,
			subtitle: track.artistName ?? track.albumName,
			thumbnailUrl: albumCoverUrl(track.albumId),
			visible: true
		}));
		setupMediaSession(track);
		preloadNextAudio();
	}

	function stopAudio() {
		if (audioEl) {
			audioEl.pause();
			audioEl.src = '';
		}
		nextAudio = null;
	}

	function stopVideo() {
		if (videoEl) {
			videoEl.pause();
			if (hlsInstance) {
				hlsInstance.destroy();
				hlsInstance = null;
			}
			videoEl.src = '';
			videoEl.load();
		}
	}

	function tracksToQueue(albumId: number, albumName: string, tracks: TrackView[]): AudioQueueItem[] {
		return tracks.map((t) => ({
			id: t.id,
			title: t.title,
			artistName: t.artist_name,
			durationSeconds: t.duration_seconds,
			mimeType: t.mime_type,
			albumId,
			albumName
		}));
	}

	// ────────── Public API ──────────

	function setElements(audio: HTMLAudioElement, video: HTMLVideoElement) {
		audioEl = audio;
		audioEl.crossOrigin = 'use-credentials';
		setupAudioEvents();

		videoEl = video;
		videoEl.crossOrigin = 'use-credentials';

		// Restore audio session if there was a saved queue
		const state = get({ subscribe });
		if (state.type === 'audio' && state.queue.length > 0) {
			restoreAudioSession();
		}
	}

	async function playAlbum(rootCollectionId: number, albumId: number) {
		try {
			const data = await listAlbumTracks(rootCollectionId, albumId);
			if (data.tracks.length === 0) return;
			stopVideo();
			const queue = tracksToQueue(albumId, data.album.name, data.tracks);
			update((s) => {
				const ns = { ...s, type: 'audio' as const, queue, queueIndex: 0, visible: true };
				persist(ns);
				return ns;
			});
			playCurrentAudioTrack();
		} catch {
			// ignore
		}
	}

	function playAlbumFromTrack(
		albumId: number,
		albumName: string,
		tracks: TrackView[],
		startIndex: number
	) {
		stopVideo();
		const queue = tracksToQueue(albumId, albumName, tracks);
		update((s) => {
			const ns = { ...s, type: 'audio' as const, queue, queueIndex: startIndex, visible: true };
			persist(ns);
			return ns;
		});
		playCurrentAudioTrack();
	}

	async function playVideo(params: VideoPlayParams) {
		if (!videoEl) return;
		stopAudio();

		update((s) => ({
			...s,
			type: 'video' as const,
			itemId: params.itemId,
			title: params.title,
			subtitle: params.collectionName,
			thumbnailUrl: params.thumbnailUrl,
			collectionId: params.collectionId,
			collectionType: params.collectionType,
			bookmarkSeconds: params.bookmarkSeconds,
			isPlaying: false,
			currentTime: 0,
			duration: 0,
			visible: true,
			queue: [],
			queueIndex: 0
		}));

		const { getStreamUrl } = await import('$lib/api/video');
		const streamUrl = getStreamUrl(params.itemId);

		if (hlsInstance) {
			hlsInstance.destroy();
			hlsInstance = null;
		}

		try {
			const res = await fetch(streamUrl, { credentials: 'include', redirect: 'follow' });
			const finalUrl = res.url;

			if (finalUrl.endsWith('.m3u8')) {
				const Hls = (await import('hls.js')).default;
				if (Hls.isSupported()) {
					hlsInstance = new Hls();
					hlsInstance.loadSource(finalUrl);
					hlsInstance.attachMedia(videoEl);
					hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
						videoEl?.play().catch(() => {});
					});
				} else {
					// Safari: native HLS support
					videoEl.src = finalUrl;
					videoEl.play().catch(() => {});
				}
			} else {
				videoEl.src = finalUrl;
				videoEl.play().catch(() => {});
			}
		} catch {
			// stream fetch failed — no-op
		}

		// Wire video element events
		videoEl.onloadedmetadata = () => {
			if (videoEl) {
				update((s) => (s.type === 'video' ? { ...s, duration: videoEl!.duration } : s));
				if (params.bookmarkSeconds) {
					videoEl.currentTime = params.bookmarkSeconds;
				}
			}
		};
		videoEl.onplay = () => update((s) => (s.type === 'video' ? { ...s, isPlaying: true } : s));
		videoEl.onpause = () => update((s) => (s.type === 'video' ? { ...s, isPlaying: false } : s));
	}

	// Called by MediaPlayer component on video timeupdate (keeps state in sync + allows bookmark logic in component)
	function updateCurrentTime(time: number) {
		update((s) => ({ ...s, currentTime: time }));
	}

	function play() {
		const state = get({ subscribe });
		if (state.type === 'audio' && audioEl) {
			audioEl.play().catch(() => {});
			update((s) => ({ ...s, isPlaying: true }));
			if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
		} else if (state.type === 'video' && videoEl) {
			videoEl.play().catch(() => {});
		}
	}

	function pause() {
		const state = get({ subscribe });
		if (state.type === 'audio' && audioEl) {
			audioEl.pause();
			update((s) => ({ ...s, isPlaying: false }));
			if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
		} else if (state.type === 'video' && videoEl) {
			videoEl.pause();
		}
	}

	function seekTo(time: number) {
		const state = get({ subscribe });
		if (state.type === 'audio' && audioEl) {
			audioEl.currentTime = time;
			if ('mediaSession' in navigator && isFinite(audioEl.duration)) {
				navigator.mediaSession.setPositionState({
					duration: audioEl.duration,
					playbackRate: audioEl.playbackRate,
					position: Math.min(Math.max(time, 0), audioEl.duration)
				});
			}
		} else if (state.type === 'video' && videoEl) {
			videoEl.currentTime = time;
		}
		update((s) => ({ ...s, currentTime: time }));
	}

	function next() {
		const state = get({ subscribe });
		if (state.type !== 'audio') return;

		if (state.repeat === 'one') {
			if (audioEl) {
				audioEl.currentTime = 0;
				audioEl.play().catch(() => {});
			}
			return;
		}

		let nextIdx = state.queueIndex + 1;
		if (state.shuffle) nextIdx = Math.floor(Math.random() * state.queue.length);

		if (nextIdx >= state.queue.length) {
			if (state.repeat === 'all') {
				nextIdx = 0;
			} else {
				stopAudio();
				update((s) => {
					const ns = { ...s, type: null as null, isPlaying: false, visible: false, queue: [], queueIndex: 0 };
					persist(ns);
					return ns;
				});
				return;
			}
		}

		// Use preloaded src if next is sequential
		if (nextAudio && !state.shuffle && nextIdx === state.queueIndex + 1 && audioEl) {
			const preloadedSrc = nextAudio.src;
			nextAudio = null;
			audioEl.src = preloadedSrc;
			audioEl.volume = state.volume;
			audioEl.play().catch(() => {});

			const track = state.queue[nextIdx];
			update((s) => {
				const ns = {
					...s,
					queueIndex: nextIdx,
					isPlaying: true,
					currentTime: 0,
					duration: 0,
					title: track.title,
					subtitle: track.artistName ?? track.albumName,
					thumbnailUrl: albumCoverUrl(track.albumId)
				};
				persist(ns);
				return ns;
			});
			setupMediaSession(track);
			preloadNextAudio();
		} else {
			update((s) => {
				const ns = { ...s, queueIndex: nextIdx };
				persist(ns);
				return ns;
			});
			playCurrentAudioTrack();
		}
	}

	function previous() {
		const state = get({ subscribe });
		if (state.type !== 'audio') return;

		if (audioEl && audioEl.currentTime > 3) {
			audioEl.currentTime = 0;
			return;
		}
		const prevIdx = Math.max(0, state.queueIndex - 1);
		update((s) => {
			const ns = { ...s, queueIndex: prevIdx };
			persist(ns);
			return ns;
		});
		playCurrentAudioTrack();
	}

	function setVolume(volume: number) {
		if (audioEl) audioEl.volume = volume;
		if (videoEl) videoEl.volume = volume;
		update((s) => {
			const ns = { ...s, volume };
			persist(ns);
			return ns;
		});
	}

	function toggleShuffle() {
		update((s) => {
			const ns = { ...s, shuffle: !s.shuffle };
			persist(ns);
			return ns;
		});
	}

	function toggleRepeat() {
		update((s) => {
			const order: MediaPlayerState['repeat'][] = ['none', 'all', 'one'];
			const idx = order.indexOf(s.repeat);
			const ns = { ...s, repeat: order[(idx + 1) % order.length] };
			persist(ns);
			return ns;
		});
	}

	function close() {
		const state = get({ subscribe });
		if (state.type === 'audio') {
			stopAudio();
			update((s) => {
				const ns = { ...s, type: null as null, isPlaying: false, visible: false, queue: [], queueIndex: 0 };
				persist(ns);
				return ns;
			});
		} else if (state.type === 'video') {
			stopVideo();
			update((s) => ({ ...s, type: null as null, isPlaying: false, visible: false, itemId: null }));
		}
	}

	function setIsFullPlayer(value: boolean) {
		update((s) => ({ ...s, isFullPlayer: value }));
	}

	return {
		subscribe,
		setElements,
		playAlbum,
		playAlbumFromTrack,
		playVideo,
		play,
		pause,
		next,
		previous,
		seekTo,
		setVolume,
		toggleShuffle,
		toggleRepeat,
		close,
		setIsFullPlayer,
		updateCurrentTime
	};
}

export const mediaPlayer = createMediaPlayerStore();

import { writable, get } from 'svelte/store';
import { listAlbumTracks, audioStreamUrl, albumCoverUrl } from '$lib/api/music';
import type { TrackView } from '$lib/types';

export interface QueueTrack {
	id: number;
	title: string;
	artistName: string | null;
	durationSeconds: number | null;
	mimeType: string;
	albumId: number;
	albumName: string;
}

export interface MusicPlayerState {
	queue: QueueTrack[];
	currentIndex: number;
	isPlaying: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	shuffle: boolean;
	repeat: 'none' | 'one' | 'all';
	visible: boolean;
}

const STORAGE_KEY = 'bokeh-music-player';

function loadState(): Partial<MusicPlayerState> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			return {
				queue: parsed.queue ?? [],
				currentIndex: parsed.currentIndex ?? 0,
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

function createMusicPlayerStore() {
	const saved = loadState();
	const { subscribe, set, update } = writable<MusicPlayerState>({
		queue: saved.queue ?? [],
		currentIndex: saved.currentIndex ?? 0,
		isPlaying: false,
		currentTime: saved.currentTime ?? 0,
		duration: 0,
		volume: saved.volume ?? 1,
		shuffle: saved.shuffle ?? false,
		repeat: saved.repeat ?? 'none',
		visible: saved.visible ?? (saved.queue?.length ?? 0) > 0
	});

	// Persist queue state
	function persist(state: MusicPlayerState) {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					queue: state.queue,
					currentIndex: state.currentIndex,
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

	// Audio elements for gapless playback
	let currentAudio: HTMLAudioElement | null = null;
	let nextAudio: HTMLAudioElement | null = null;
	let lastPersistTime = 0;

	function createAudioElement(): HTMLAudioElement {
		const audio = new Audio();
		audio.crossOrigin = 'use-credentials';
		return audio;
	}

	function setupAudioEvents(audio: HTMLAudioElement) {
		audio.ontimeupdate = () => {
			update((s) => ({ ...s, currentTime: audio.currentTime }));
			const now = Date.now();
			if (now - lastPersistTime >= 1000) {
				lastPersistTime = now;
				persist(get({ subscribe }));
			}
		};
		audio.onloadedmetadata = () => {
			update((s) => ({ ...s, duration: audio.duration }));
		};
		audio.onended = () => {
			next();
		};
		audio.onerror = () => {
			// Skip to next track on error
			next();
		};
	}

	// Restore paused session from a previous page load
	function restoreSession() {
		const state = get({ subscribe });
		const track = state.queue[state.currentIndex];
		if (!track) return;

		currentAudio = createAudioElement();
		currentAudio.volume = state.volume;
		currentAudio.src = audioStreamUrl(track.id);
		setupAudioEvents(currentAudio);
		// Don't play — restore paused at saved position
		const savedTime = state.currentTime;
		if (savedTime > 0) {
			currentAudio.addEventListener(
				'loadedmetadata',
				() => {
					if (currentAudio) currentAudio.currentTime = savedTime;
				},
				{ once: true }
			);
		}

		if ('mediaSession' in navigator) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: track.title,
				artist: track.artistName ?? '',
				album: track.albumName,
				artwork: [{ src: albumCoverUrl(track.albumId), sizes: '400x400' }]
			});
			navigator.mediaSession.setActionHandler('play', () => play());
			navigator.mediaSession.setActionHandler('pause', () => pause());
			navigator.mediaSession.setActionHandler('previoustrack', () => previous());
			navigator.mediaSession.setActionHandler('nexttrack', () => next());
			navigator.mediaSession.setActionHandler('seekto', (details) => {
				if (details.seekTime != null) seekTo(details.seekTime);
			});
		}

		preloadNext();
	}

	function playCurrentTrack() {
		const state = get({ subscribe });
		const track = state.queue[state.currentIndex];
		if (!track) return;

		if (currentAudio) {
			currentAudio.pause();
			currentAudio.ontimeupdate = null;
			currentAudio.onloadedmetadata = null;
			currentAudio.onended = null;
		}

		currentAudio = createAudioElement();
		currentAudio.volume = state.volume;
		currentAudio.src = audioStreamUrl(track.id);
		setupAudioEvents(currentAudio);
		currentAudio.play().catch(() => {});

		// Update MediaSession
		if ('mediaSession' in navigator) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: track.title,
				artist: track.artistName ?? '',
				album: track.albumName,
				artwork: [
					{ src: albumCoverUrl(track.albumId), sizes: '400x400' }
				]
			});
			navigator.mediaSession.setActionHandler('play', () => play());
			navigator.mediaSession.setActionHandler('pause', () => pause());
			navigator.mediaSession.setActionHandler('previoustrack', () => previous());
			navigator.mediaSession.setActionHandler('nexttrack', () => next());
			navigator.mediaSession.setActionHandler('seekto', (details) => {
				if (details.seekTime != null) seekTo(details.seekTime);
			});
		}

		update((s) => ({ ...s, isPlaying: true, currentTime: 0, duration: 0 }));

		// Preload next track
		preloadNext();
	}

	function preloadNext() {
		const state = get({ subscribe });
		const nextIndex = state.currentIndex + 1;
		if (nextIndex < state.queue.length) {
			nextAudio = createAudioElement();
			nextAudio.src = audioStreamUrl(state.queue[nextIndex].id);
			nextAudio.preload = 'auto';
		}
	}

	function tracksToQueue(albumId: number, albumName: string, tracks: TrackView[]): QueueTrack[] {
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

	async function playAlbum(rootCollectionId: number, albumId: number) {
		try {
			const data = await listAlbumTracks(rootCollectionId, albumId);
			if (data.tracks.length === 0) return;

			const queue = tracksToQueue(albumId, data.album.name, data.tracks);
			update((s) => {
				const newState = { ...s, queue, currentIndex: 0, visible: true };
				persist(newState);
				return newState;
			});
			playCurrentTrack();
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
		const queue = tracksToQueue(albumId, albumName, tracks);
		update((s) => {
			const newState = { ...s, queue, currentIndex: startIndex, visible: true };
			persist(newState);
			return newState;
		});
		playCurrentTrack();
	}

	function play() {
		if (currentAudio) {
			currentAudio.play().catch(() => {});
			update((s) => ({ ...s, isPlaying: true }));
		}
	}

	function pause() {
		if (currentAudio) {
			currentAudio.pause();
			update((s) => ({ ...s, isPlaying: false }));
		}
	}

	function next() {
		const state = get({ subscribe });
		if (state.repeat === 'one') {
			if (currentAudio) {
				currentAudio.currentTime = 0;
				currentAudio.play().catch(() => {});
			}
			return;
		}

		let nextIndex = state.currentIndex + 1;
		if (state.shuffle) {
			nextIndex = Math.floor(Math.random() * state.queue.length);
		}

		if (nextIndex >= state.queue.length) {
			if (state.repeat === 'all') {
				nextIndex = 0;
			} else {
				// Playlist ended — close player
				update((s) => {
					const newState = { ...s, isPlaying: false, visible: false, queue: [], currentIndex: 0 };
					persist(newState);
					return newState;
				});
				if (currentAudio) {
					currentAudio.pause();
					currentAudio = null;
				}
				return;
			}
		}

		// Use preloaded audio if available and it matches
		if (nextAudio && !state.shuffle && nextIndex === state.currentIndex + 1) {
			if (currentAudio) {
				currentAudio.pause();
				currentAudio.ontimeupdate = null;
				currentAudio.onloadedmetadata = null;
				currentAudio.onended = null;
			}
			currentAudio = nextAudio;
			nextAudio = null;
			setupAudioEvents(currentAudio);
			currentAudio.volume = state.volume;
			currentAudio.play().catch(() => {});
			update((s) => {
				const newState = { ...s, currentIndex: nextIndex, isPlaying: true, currentTime: 0, duration: 0 };
				persist(newState);
				return newState;
			});
			// Update MediaSession for new track
			const track = state.queue[nextIndex];
			if (track && 'mediaSession' in navigator) {
				navigator.mediaSession.metadata = new MediaMetadata({
					title: track.title,
					artist: track.artistName ?? '',
					album: track.albumName,
					artwork: [{ src: albumCoverUrl(track.albumId), sizes: '400x400' }]
				});
			}
			preloadNext();
		} else {
			update((s) => {
				const newState = { ...s, currentIndex: nextIndex };
				persist(newState);
				return newState;
			});
			playCurrentTrack();
		}
	}

	function previous() {
		const state = get({ subscribe });
		// If more than 3 seconds in, restart current track
		if (currentAudio && currentAudio.currentTime > 3) {
			currentAudio.currentTime = 0;
			return;
		}
		const prevIndex = Math.max(0, state.currentIndex - 1);
		update((s) => {
			const newState = { ...s, currentIndex: prevIndex };
			persist(newState);
			return newState;
		});
		playCurrentTrack();
	}

	function seekTo(time: number) {
		if (currentAudio) {
			currentAudio.currentTime = time;
			update((s) => ({ ...s, currentTime: time }));
		}
	}

	function setVolume(volume: number) {
		if (currentAudio) {
			currentAudio.volume = volume;
		}
		update((s) => {
			const newState = { ...s, volume };
			persist(newState);
			return newState;
		});
	}

	function toggleShuffle() {
		update((s) => {
			const newState = { ...s, shuffle: !s.shuffle };
			persist(newState);
			return newState;
		});
	}

	function toggleRepeat() {
		update((s) => {
			const order: MusicPlayerState['repeat'][] = ['none', 'all', 'one'];
			const idx = order.indexOf(s.repeat);
			const newRepeat = order[(idx + 1) % order.length];
			const newState = { ...s, repeat: newRepeat };
			persist(newState);
			return newState;
		});
	}

	function close() {
		if (currentAudio) {
			currentAudio.pause();
			currentAudio = null;
		}
		if (nextAudio) {
			nextAudio = null;
		}
		update((s) => {
			const newState = { ...s, isPlaying: false, visible: false, queue: [], currentIndex: 0 };
			persist(newState);
			return newState;
		});
	}

	// If there's a saved queue, restore the player in a paused state
	if (saved.queue && saved.queue.length > 0) {
		restoreSession();
	}

	return {
		subscribe,
		playAlbum,
		playAlbumFromTrack,
		play,
		pause,
		next,
		previous,
		seekTo,
		setVolume,
		toggleShuffle,
		toggleRepeat,
		close
	};
}

export const musicPlayerStore = createMusicPlayerStore();

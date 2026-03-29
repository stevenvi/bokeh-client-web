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

// ---------------------------------------------------------------------------
// MediaSession bridge — single point of contact with the OS media layer.
//
// All communication with navigator.mediaSession flows through these
// functions. Nothing else in this module touches mediaSession directly.
// ---------------------------------------------------------------------------

const hasMediaSession = typeof navigator !== 'undefined' && 'mediaSession' in navigator;

/** Register action handlers once. Callbacks are stable closures into the store. */
function msInit(callbacks: {
	play: () => void;
	pause: () => void;
	previous: () => void;
	next: () => void;
	seekTo: (time: number) => void;
}) {
	if (!hasMediaSession) return;
	navigator.mediaSession.setActionHandler('play', callbacks.play);
	navigator.mediaSession.setActionHandler('pause', callbacks.pause);
	navigator.mediaSession.setActionHandler('previoustrack', callbacks.previous);
	navigator.mediaSession.setActionHandler('nexttrack', callbacks.next);
	navigator.mediaSession.setActionHandler('seekto', (details) => {
		if (details.seekTime != null) callbacks.seekTo(details.seekTime);
	});
}

/** Push track metadata (title, artist, artwork). Call when track changes. */
function msSetTrack(track: QueueTrack) {
	if (!hasMediaSession) return;
	navigator.mediaSession.metadata = new MediaMetadata({
		title: track.title,
		artist: track.artistName ?? '',
		album: track.albumName,
		artwork: [{ src: albumCoverUrl(track.albumId), sizes: '400x400' }]
	});
}

/** Tell the OS whether we are playing or paused. */
function msSetPlaying(playing: boolean) {
	if (!hasMediaSession) return;
	navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

/**
 * Push the authoritative position/duration to the OS.
 * Must be called after msSetPlaying so the OS shows the correct state.
 * Also must be called periodically (ontimeupdate) to keep the scrubber in
 * sync, and immediately after any seek.
 */
function msSetPosition(position: number, duration: number, playbackRate = 1) {
	if (!hasMediaSession) return;
	if (!duration || !isFinite(duration)) return;
	try {
		navigator.mediaSession.setPositionState({
			duration,
			playbackRate,
			position: Math.min(Math.max(position, 0), duration)
		});
	} catch {
		// Safari can throw if position > duration due to floating-point
	}
}

/** Clear everything — used when the player is closed. */
function msClear() {
	if (!hasMediaSession) return;
	navigator.mediaSession.metadata = null;
	navigator.mediaSession.playbackState = 'none';
	try { navigator.mediaSession.setPositionState(); } catch { /* not all browsers support reset */ }
}

// ---------------------------------------------------------------------------
// Player store
// ---------------------------------------------------------------------------

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

	// Single persistent audio element. Reusing one element across tracks
	// keeps the OS media session stably bound to it — creating a new element
	// per track confuses iOS into not reflecting the correct playing state.
	const audioEl = new Audio();
	audioEl.crossOrigin = 'use-credentials';
	audioEl.volume = saved.volume ?? 1;

	let lastPersistTime = 0;

	audioEl.ontimeupdate = () => {
		const time = audioEl.currentTime;
		update((s) => ({ ...s, currentTime: time }));
		// Do NOT call msSetPosition here. The spec intends setPositionState to
		// be called only at non-obvious transitions; the OS projects position
		// forward on its own using playbackRate. Calling it on every tick
		// causes macOS to continuously re-anchor from a potentially stale value,
		// making the scrubber appear stuck at the pre-seek position.
		const now = Date.now();
		if (now - lastPersistTime >= 1000) {
			lastPersistTime = now;
			persist(get({ subscribe }));
		}
	};

	audioEl.onloadedmetadata = () => {
		const dur = audioEl.duration;
		update((s) => ({ ...s, duration: dur }));
		// Duration is now known — give the OS a complete picture so the
		// scrubber has a valid range from the start.
		msSetPlaying(!audioEl.paused);
		msSetPosition(audioEl.currentTime, dur, audioEl.playbackRate);
	};

	audioEl.onplaying = () => {
		update((s) => ({ ...s, isPlaying: true }));
		msSetPlaying(true);
		if (isFinite(audioEl.duration)) {
			msSetPosition(audioEl.currentTime, audioEl.duration, audioEl.playbackRate);
		}
	};

	audioEl.onpause = () => {
		if (audioEl.ended) return;
		update((s) => ({ ...s, isPlaying: false }));
		msSetPlaying(false);
		if (isFinite(audioEl.duration)) {
			msSetPosition(audioEl.currentTime, audioEl.duration, audioEl.playbackRate);
		}
	};

	// After a seek completes, push the authoritative final position.
	audioEl.onseeked = () => {
		if (isFinite(audioEl.duration)) {
			msSetPosition(audioEl.currentTime, audioEl.duration, audioEl.playbackRate);
		}
	};

	// iOS fires 'emptied' when src is changed and briefly reverts the lock
	// screen to the first metadata ever registered for this element.
	// Re-push the current track's metadata immediately to suppress the flash.
	audioEl.onemptied = () => {
		const state = get({ subscribe });
		const track = state.queue[state.currentIndex];
		if (track) msSetTrack(track);
	};

	audioEl.onended = () => {
		next();
	};

	audioEl.onerror = () => {
		next();
	};

	// Register MediaSession action handlers once with stable closures.
	msInit({
		play: () => play(),
		pause: () => pause(),
		previous: () => previous(),
		next: () => next(),
		seekTo: (time: number) => seekTo(time)
	});

	// Restore paused session from a previous page load
	function restoreSession() {
		const state = get({ subscribe });
		const track = state.queue[state.currentIndex];
		if (!track) return;

		// Set metadata before src so that when the element fires 'emptied'
		// (on src change), onemptied re-pushes the correct track rather than
		// iOS reverting to whatever was cached from a prior session.
		msSetTrack(track);
		msSetPlaying(false);

		audioEl.src = audioStreamUrl(track.id);

		const savedTime = state.currentTime;
		if (savedTime > 0) {
			audioEl.addEventListener(
				'loadedmetadata',
				() => { audioEl.currentTime = savedTime; },
				{ once: true }
			);
		}
	}

	function playCurrentTrack() {
		const state = get({ subscribe });
		const track = state.queue[state.currentIndex];
		if (!track) return;

		// Set metadata before src — onemptied will re-push it, but setting it
		// here first means the OS gets the correct track immediately rather
		// than after a round-trip through emptied.
		msSetTrack(track);
		if (track.durationSeconds) {
			msSetPosition(0, track.durationSeconds, 1);
		}

		audioEl.src = audioStreamUrl(track.id);
		// No explicit load() — play() triggers the resource load, and
		// avoiding load() prevents an unnecessary emptied/reset cycle that
		// causes iOS to flash old metadata on the lock screen.
		audioEl.play().catch(() => {});
		// onplaying pushes msSetPlaying(true) + msSetPosition once audio
		// is genuinely outputting.

		update((s) => ({ ...s, isPlaying: true, currentTime: 0, duration: 0 }));
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
		audioEl.play().catch(() => {});
		// onplaying syncs state to store + OS
	}

	function pause() {
		audioEl.pause();
		// onpause syncs state to store + OS
	}

	function next() {
		const state = get({ subscribe });
		if (state.repeat === 'one') {
			audioEl.currentTime = 0;
			audioEl.play().catch(() => {});
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
				audioEl.pause();
				update((s) => {
					const newState = { ...s, isPlaying: false, visible: false, queue: [], currentIndex: 0 };
					persist(newState);
					return newState;
				});
				msClear();
				return;
			}
		}

		update((s) => {
			const newState = { ...s, currentIndex: nextIndex };
			persist(newState);
			return newState;
		});
		playCurrentTrack();
	}

	function previous() {
		const state = get({ subscribe });
		if (audioEl.currentTime > 3) {
			audioEl.currentTime = 0;
			msSetPosition(0, audioEl.duration, audioEl.playbackRate);
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
		audioEl.currentTime = time;
		update((s) => ({ ...s, currentTime: time }));
		// onseeked will push the definitive position once the seek lands
	}

	function setVolume(volume: number) {
		audioEl.volume = volume;
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
		audioEl.pause();
		audioEl.src = '';
		update((s) => {
			const newState = { ...s, isPlaying: false, visible: false, queue: [], currentIndex: 0 };
			persist(newState);
			return newState;
		});
		msClear();
	}

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

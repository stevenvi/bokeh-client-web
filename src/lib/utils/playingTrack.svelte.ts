import { get } from 'svelte/store';
import { mediaPlayer, type MediaPlayerState } from '$lib/stores/mediaPlayer';

/**
 * Returns the id of the currently playing track in the media player iff
 * its queue's current item belongs to the given album/show. Otherwise null.
 *
 * The mediaPlayer store uses `albumId` on each AudioQueueItem; for radio
 * shows this is set to the showId via playShowFromEpisode. So the same
 * function works for both.
 */
export function currentlyPlayingTrackId(albumOrShowId: number): number | null {
	const state = get(mediaPlayer);
	if (state.type !== 'audio') return null;
	const cur = state.queue[state.queueIndex];
	if (!cur || cur.albumId !== albumOrShowId) return null;
	return cur.id;
}

export function playingTrackIdFromState(
	state: MediaPlayerState,
	albumOrShowId: number
): number | null {
	if (state.type !== 'audio') return null;
	const cur = state.queue[state.queueIndex];
	if (!cur || cur.albumId !== albumOrShowId) return null;
	return cur.id;
}

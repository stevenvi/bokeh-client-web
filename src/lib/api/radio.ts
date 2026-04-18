import { apiFetch } from './client';
import type { ShowEpisodesResponse } from '$lib/types';

export function listShows(collectionId: number): Promise<{ shows: import('$lib/types').ShowSummary[] }> {
	return apiFetch(`/api/v1/collections/${collectionId}/shows`);
}

export function listShowEpisodes(collectionId: number, showId: number): Promise<ShowEpisodesResponse> {
	return apiFetch(`/api/v1/collections/${collectionId}/shows/${showId}/episodes`);
}

export function upsertShowBookmark(showId: number, mediaItemId: number, positionSeconds: number): Promise<void> {
	return apiFetch(`/api/v1/audio-shows/${showId}/bookmark`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ media_item_id: mediaItemId, position_seconds: positionSeconds })
	});
}

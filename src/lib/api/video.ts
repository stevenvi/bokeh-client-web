import { get } from 'svelte/store';
import { apiFetch } from './client';
import { appStore } from '$lib/stores/app';

function base(): string {
	return get(appStore).serverUrl ?? '';
}

// Returns the stream URL. The server redirects to /raw (LAN) or HLS manifest (remote).
// Callers must probe the redirect: fetch the URL, check response.url.
// If it ends with .m3u8 → initialize HLS.js. Otherwise → set videoEl.src directly.
export function getStreamUrl(itemId: number): string {
	return `${base()}/videos/${itemId}/stream`;
}

export function videoCoverUrl(itemId: number): string {
	return `${base()}/images/videos/${itemId}/cover`;
}

export function setBookmark(itemId: number, positionSeconds: number): Promise<void> {
	return apiFetch<void>(`/api/v1/media/${itemId}/bookmark`, {
		method: 'PUT',
		body: JSON.stringify({ position_seconds: positionSeconds })
	});
}

export function clearBookmark(itemId: number): Promise<void> {
	return apiFetch<void>(`/api/v1/media/${itemId}/bookmark`, {
		method: 'DELETE'
	});
}

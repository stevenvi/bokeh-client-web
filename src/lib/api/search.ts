import { apiFetch } from './client';
import type {
	SearchPhotosResponse,
	SearchVideosResponse,
	SearchAudioArtistsResponse,
	SearchAudioAlbumsResponse,
	SearchAudioTracksResponse
} from '$lib/types';

function buildParams(q: string, offset: number, limit: number): URLSearchParams {
	return new URLSearchParams({
		q,
		offset: String(offset),
		limit: String(limit)
	});
}

export function searchPhotos(q: string, offset = 0, limit = 200): Promise<SearchPhotosResponse> {
	return apiFetch<SearchPhotosResponse>(`/api/v1/search/photos?${buildParams(q, offset, limit)}`);
}

export function searchVideos(q: string, offset = 0, limit = 50): Promise<SearchVideosResponse> {
	return apiFetch<SearchVideosResponse>(`/api/v1/search/videos?${buildParams(q, offset, limit)}`);
}

export function searchAudioArtists(
	q: string,
	offset = 0,
	limit = 10
): Promise<SearchAudioArtistsResponse> {
	return apiFetch<SearchAudioArtistsResponse>(
		`/api/v1/search/audio/artists?${buildParams(q, offset, limit)}`
	);
}

export function searchAudioAlbums(
	q: string,
	offset = 0,
	limit = 10
): Promise<SearchAudioAlbumsResponse> {
	return apiFetch<SearchAudioAlbumsResponse>(
		`/api/v1/search/audio/albums?${buildParams(q, offset, limit)}`
	);
}

export function searchAudioTracks(
	q: string,
	offset = 0,
	limit = 15
): Promise<SearchAudioTracksResponse> {
	return apiFetch<SearchAudioTracksResponse>(
		`/api/v1/search/audio/tracks?${buildParams(q, offset, limit)}`
	);
}

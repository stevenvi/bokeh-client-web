import { get } from 'svelte/store';
import { apiFetch } from './client';
import { appStore } from '$lib/stores/app';
import type { ArtistsPage, ArtistAlbumsResponse, TracksResponse } from '$lib/types';

export function listArtists(
	collectionId: number,
	page = 1,
	pageSize = 50,
	search = ''
): Promise<ArtistsPage> {
	const params = new URLSearchParams({
		page: String(page),
		page_size: String(pageSize)
	});
	if (search) params.set('search', search);
	return apiFetch<ArtistsPage>(
		`/api/v1/collections/${collectionId}/artists?${params}`
	);
}

export function listArtistAlbums(collectionId: number, artistId: number): Promise<ArtistAlbumsResponse> {
	return apiFetch<ArtistAlbumsResponse>(`/api/v1/collections/${collectionId}/artists/${artistId}/albums`);
}

export function listAlbumTracks(rootCollectionId: number, albumId: number): Promise<TracksResponse> {
	return apiFetch<TracksResponse>(
		`/api/v1/collections/${rootCollectionId}/albums/${albumId}/tracks`
	);
}

function base(): string {
	return get(appStore).serverUrl ?? '';
}

export function audioStreamUrl(id: number): string {
	return `${base()}/audio/${id}/stream`;
}

export function artistImageUrl(id: number): string {
	return `${base()}/images/artists/${id}/cover`;
}

export function albumCoverUrl(albumId: number): string {
	return `${base()}/images/albums/${albumId}/cover`;
}

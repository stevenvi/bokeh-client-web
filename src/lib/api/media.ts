import { get } from 'svelte/store';
import { apiFetch } from './client';
import { appStore } from '$lib/stores/app';
import type { MediaItemDetail, ImageVariant } from '$lib/types';

export function getMediaItem(id: number): Promise<MediaItemDetail> {
	return apiFetch<MediaItemDetail>(`/api/v1/media/${id}`);
}

function base(): string {
	return get(appStore).serverUrl ?? '';
}

export function imageVariantUrl(id: number, variant: ImageVariant): string {
	return `${base()}/images/${id}/${variant}`;
}

export function dziManifestUrl(id: number): string {
	return `${base()}/images/${id}/tiles/image.dzi`;
}

export function collectionCoverUrl(id: number): string {
	return `${base()}/images/collections/${id}/cover`;
}

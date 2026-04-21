import { get } from 'svelte/store';
import { apiFetch } from './client';
import { appStore } from '$lib/stores/app';
import type { ImageVariant } from '$lib/types';

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

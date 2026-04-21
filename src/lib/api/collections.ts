import { apiFetch } from './client';
import type { CollectionSummary, CollectionView, VideoItemView, PhotoItem, PhotoStats } from '$lib/types';

export function listCollections(): Promise<CollectionSummary[]> {
	return apiFetch<CollectionSummary[]>('/api/v1/collections');
}

export function getCollection(id: number): Promise<CollectionView> {
	return apiFetch<CollectionView>(`/api/v1/collections/${id}`);
}

export function listChildCollections(id: number): Promise<CollectionSummary[]> {
	return apiFetch<CollectionSummary[]>(`/api/v1/collections/${id}/collections`);
}

export interface ItemsPage {
	items: VideoItemView[];
	page: number;
	next_page: number | null;
	page_size: number;
}

export function listVideos(id: number, page: number, pageSize = 50): Promise<ItemsPage> {
	return apiFetch<ItemsPage>(`/api/v1/collections/${id}/videos?page=${page}&page_size=${pageSize}`);
}

export interface PhotosPage {
	items: PhotoItem[];
	offset: number;
	limit: number;
}

export interface PhotoOptions {
	sortOrder?: 'asc' | 'desc';
	recursive?: boolean;
	offset?: number;
	limit?: number;
}

export function listPhotos(id: number, opts: PhotoOptions = {}): Promise<PhotosPage> {
	const params = new URLSearchParams();
	if (opts.sortOrder) params.set('sort_order', opts.sortOrder);
	if (opts.recursive) params.set('recursive', 'true');
	if (opts.offset != null) params.set('offset', String(opts.offset));
	if (opts.limit != null) params.set('limit', String(opts.limit));
	return apiFetch<PhotosPage>(`/api/v1/collections/${id}/photos?${params}`);
}

export interface SlideshowMonthCount {
	year: number;
	month: number;
	count: number;
}

export function photoStats(id: number, recursive = false): Promise<PhotoStats> {
	const params = new URLSearchParams();
	if (recursive) params.set('recursive', 'true');
	return apiFetch<PhotoStats>(`/api/v1/collections/${id}/photos/stats?${params}`);
}

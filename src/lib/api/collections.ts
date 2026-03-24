import { apiFetch } from './client';
import type { CollectionSummary, CollectionView, MediaItemView, SlideshowItem } from '$lib/types';

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
	items: MediaItemView[];
	page: number;
	next_page: number | null;
	page_size: number;
}

export function listItems(id: number, page: number, pageSize = 50): Promise<ItemsPage> {
	return apiFetch<ItemsPage>(
		`/api/v1/collections/${id}/items?page=${page}&page_size=${pageSize}`
	);
}

export interface SlideshowPage {
	items: SlideshowItem[];
	next_cursor: string | null;
	prev_cursor: string | null;
	page_size: number;
}

export interface SlideshowOptions {
	order?: 'asc' | 'desc';
	recursive?: boolean;
	cursor?: string | null;
	start?: number | null;
	startDate?: string | null; // "YYYY-MM"
	pageSize?: number;
}

export function slideshowPage(id: number, opts: SlideshowOptions = {}): Promise<SlideshowPage> {
	const params = new URLSearchParams({
		order: opts.order ?? 'asc',
		page_size: String(opts.pageSize ?? 200)
	});
	if (opts.recursive === false) params.set('recursive', 'false');
	if (opts.cursor) params.set('cursor', opts.cursor);
	if (opts.start != null) params.set('start', String(opts.start));
	if (opts.startDate) params.set('start_date', opts.startDate);
	return apiFetch<SlideshowPage>(`/api/v1/collections/${id}/slideshow?${params}`);
}

export interface SlideshowMonthCount {
	year: number;
	month: number;
	count: number;
}

export interface SlideshowMetadata {
	months: SlideshowMonthCount[];
}

export function slideshowMetadata(id: number, recursive = true): Promise<SlideshowMetadata> {
	const params = new URLSearchParams();
	if (!recursive) params.set('recursive', 'false');
	const qs = params.toString();
	return apiFetch<SlideshowMetadata>(
		`/api/v1/collections/${id}/slideshow/metadata${qs ? '?' + qs : ''}`
	);
}

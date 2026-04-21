import { writable } from 'svelte/store';
import type { PhotoItem } from '$lib/types';
import type { PhotoOptions } from '$lib/api/collections';

export interface SlideshowState {
	collectionId: number;
	items: PhotoItem[];
	total: number;
	params: PhotoOptions;
}

function createSlideshowStore() {
	const { subscribe, set, update } = writable<SlideshowState | null>(null);

	return {
		subscribe,
		set,
		appendItems(newItems: PhotoItem[]) {
			update((state) => {
				if (!state) return state;
				// Merge by ordinal — avoid duplicates
				const existing = new Set(state.items.map((i) => i.ordinal));
				const toAdd = newItems.filter((i) => !existing.has(i.ordinal));
				const merged = [...state.items, ...toAdd].sort((a, b) => a.ordinal - b.ordinal);
				return { ...state, items: merged };
			});
		},
		clear() {
			set(null);
		}
	};
}

export const slideshowStore = createSlideshowStore();

import { writable } from 'svelte/store';

export interface BreadcrumbEntry {
	id: number;
	name: string;
}

function createNavigationStore() {
	const { subscribe, update, set } = writable<BreadcrumbEntry[]>([]);

	/** Scroll positions keyed by collection ID, preserved across view transitions. */
	const scrollPositions = new Map<number, number>();

	/** View modes keyed by collection ID, preserved across view transitions. */
	const viewModes = new Map<number, string>();

	return {
		subscribe,

		push(entry: BreadcrumbEntry) {
			update((crumbs) => {
				// Avoid duplicates if navigating to the same collection.
				const existing = crumbs.findIndex((c) => c.id === entry.id);
				if (existing >= 0) {
					return crumbs.slice(0, existing + 1);
				}
				return [...crumbs, entry];
			});
		},

		/** Truncate the breadcrumb to the given collection ID (inclusive). */
		popTo(id: number) {
			update((crumbs) => {
				const idx = crumbs.findIndex((c) => c.id === id);
				return idx >= 0 ? crumbs.slice(0, idx + 1) : crumbs;
			});
		},

		reset() {
			set([]);
		},

		saveScrollPosition(collectionId: number, y: number) {
			scrollPositions.set(collectionId, y);
		},

		getScrollPosition(collectionId: number): number {
			return scrollPositions.get(collectionId) ?? 0;
		},

		saveViewMode(collectionId: number, mode: string) {
			viewModes.set(collectionId, mode);
		},

		getViewMode(collectionId: number): string | null {
			return viewModes.get(collectionId) ?? null;
		},

		clearViewMode(collectionId: number) {
			viewModes.delete(collectionId);
		}
	};
}

export const navigationStore = createNavigationStore();

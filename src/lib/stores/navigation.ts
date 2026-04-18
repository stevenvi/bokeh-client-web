import { writable } from 'svelte/store';

export interface BreadcrumbEntry {
	id: number;
	name: string;
	path: string;
}

function createNavigationStore() {
	const { subscribe, update, set } = writable<BreadcrumbEntry[]>([]);

	/** Scroll positions keyed by collection ID, preserved across view transitions. */
	const scrollPositions = new Map<number, number>();

	/** View modes keyed by collection ID, preserved across view transitions. */
	const viewModes = new Map<number, string>();

	/** Waterfall jump targets keyed by collection ID, preserved across view transitions. */
	const jumpTargets = new Map<number, string | null>();

	return {
		subscribe,

		/** Returns the path one level up in the breadcrumb trail, or '/' if at the top. */
		previousPath(): string {
			let crumbs: BreadcrumbEntry[] = [];
			const unsubscribe = subscribe((v) => { crumbs = v; });
			unsubscribe();
			return crumbs.length >= 2 ? crumbs[crumbs.length - 2].path : '/';
		},

		/** Returns a snapshot of the current breadcrumb entries. */
		getCrumbs(): BreadcrumbEntry[] {
			let crumbs: BreadcrumbEntry[] = [];
			const unsubscribe = subscribe((v) => { crumbs = v; });
			unsubscribe();
			return crumbs;
		},

		push(entry: BreadcrumbEntry) {
			update((crumbs) => {
				// Avoid duplicates by path, since IDs can collide across entity types
				// (e.g. an artist ID may equal a collection ID).
				const existing = crumbs.findIndex((c) => c.path === entry.path);
				if (existing >= 0) {
					return crumbs.slice(0, existing + 1);
				}
				return [...crumbs, entry];
			});
		},

		/** Truncate the breadcrumb to the given path (inclusive). */
		popTo(path: string) {
			update((crumbs) => {
				const idx = crumbs.findIndex((c) => c.path === path);
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
		},

		saveJumpTarget(collectionId: number, target: string | null) {
			jumpTargets.set(collectionId, target);
		},

		getJumpTarget(collectionId: number): string | null {
			return jumpTargets.get(collectionId) ?? null;
		}
	};
}

export const navigationStore = createNavigationStore();

import { writable } from 'svelte/store';

export interface BreadcrumbEntry {
	id: number;
	name: string;
	path: string;
	/** Vertical scroll offset of the page's scroll container, captured on unmount. */
	scrollY?: number;
}

function createNavigationStore() {
	const { subscribe, update, set } = writable<BreadcrumbEntry[]>([]);

	/** View modes keyed by collection ID, preserved across view transitions. */
	const viewModes = new Map<number, string>();

	/** Waterfall jump targets keyed by collection ID, preserved across view transitions. */
	const jumpTargets = new Map<number, string | null>();

	/** Reads the current entries snapshot without subscribing. */
	function snapshot(): BreadcrumbEntry[] {
		let crumbs: BreadcrumbEntry[] = [];
		const unsubscribe = subscribe((v) => { crumbs = v; });
		unsubscribe();
		return crumbs;
	}

	return {
		subscribe,

		/** Returns the path one level up in the breadcrumb trail, or '/' if at the top. */
		previousPath(): string {
			const crumbs = snapshot();
			return crumbs.length >= 2 ? crumbs[crumbs.length - 2].path : '/';
		},

		/** Returns a snapshot of the current breadcrumb entries. */
		getCrumbs(): BreadcrumbEntry[] {
			return snapshot();
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

		/**
		 * Records a scroll offset on the breadcrumb entry matching `path`.
		 * No-op if the entry isn't present (e.g. the page navigated away
		 * before pushing). Lives on the entry so it dies with it on popTo/reset.
		 */
		saveScrollForPath(path: string, y: number) {
			update((crumbs) => {
				const idx = crumbs.findIndex((c) => c.path === path);
				if (idx < 0) return crumbs;
				if (crumbs[idx].scrollY === y) return crumbs;
				const next = crumbs.slice();
				next[idx] = { ...next[idx], scrollY: y };
				return next;
			});
		},

		getScrollForPath(path: string): number {
			const entry = snapshot().find((c) => c.path === path);
			return entry?.scrollY ?? 0;
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

import { getCollection } from '$lib/api/collections';
import { navigationStore, type BreadcrumbEntry } from '$lib/stores/navigation';
import type { CollectionView } from '$lib/types';

/** Split a SvelteKit rest-param string into numeric collection IDs, or null if invalid. */
export function parseCollectionIds(pathParam: string): number[] | null {
	const segments = (pathParam ?? '').split('/').filter(Boolean);
	if (segments.length === 0) return null;
	const ids = segments.map(Number);
	if (ids.some((n) => !Number.isInteger(n) || n <= 0)) return null;
	return ids;
}

export function leafCollectionId(path: number[]): number {
	return path[path.length - 1];
}

/**
 * Fetch all collections in the ID chain in parallel and validate the
 * parent→child hierarchy. Returns null on any fetch error or hierarchy mismatch.
 */
export async function loadCollectionChain(ids: number[]): Promise<CollectionView[] | null> {
	try {
		const collections = await Promise.all(ids.map((id) => getCollection(id)));
		for (let i = 1; i < collections.length; i++) {
			if (collections[i].parent_collection_id !== collections[i - 1].id) return null;
		}
		return collections;
	} catch {
		return null;
	}
}

/**
 * Set the breadcrumb trail for a page.
 *
 * On fresh page loads (trail missing parent entries), restores the full chain
 * atomically. On in-app navigation (parents already present), just pushes the
 * leaf entry — which is what the existing push() logic expects.
 */
export function applyBreadcrumbs(entries: BreadcrumbEntry[]) {
	if (entries.length === 0) return;
	const crumbs = navigationStore.getCrumbs();
	const parentEntries = entries.slice(0, -1);
	const leafEntry = entries[entries.length - 1];
	const parentsMatch = parentEntries.every((e, i) => crumbs[i]?.path === e.path);
	if (parentsMatch) {
		navigationStore.push(leafEntry);
	} else {
		navigationStore.restore(entries);
	}
}

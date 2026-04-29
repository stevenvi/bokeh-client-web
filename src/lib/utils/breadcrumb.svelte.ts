import { goto } from '$app/navigation';
import { navigationStore, type BreadcrumbEntry } from '$lib/stores/navigation';

/**
 * Push a breadcrumb entry whenever the getter returns one. Re-pushing the same
 * path is a no-op (push() truncates duplicates), so this safely handles
 * back-navigation as well as initial mount.
 */
export function useBreadcrumb(getter: () => BreadcrumbEntry | null) {
	$effect(() => {
		const entry = getter();
		if (entry) navigationStore.push(entry);
	});
}

/**
 * Reset the breadcrumb to just this entry. Use for top-level pages (admin,
 * profile) that should always appear directly below home regardless of how
 * the user navigated there.
 */
export function useRootBreadcrumb(getter: () => BreadcrumbEntry | null) {
	$effect(() => {
		const entry = getter();
		if (entry) navigationStore.resetTo(entry);
	});
}

/**
 * Go up one level in the breadcrumb trail. No-op when at home.
 * Used by Escape and the in-app back button.
 */
export function goBack() {
	const crumbs = navigationStore.getCrumbs();
	if (crumbs.length === 0) return;
	// Walk back skipping hidden entries — those represent transient overlays
	// (slideshow, watch) that shouldn't trap the user when popping.
	for (let i = crumbs.length - 2; i >= 0; i--) {
		if (!crumbs[i].hidden) {
			goto(crumbs[i].path);
			return;
		}
	}
	goto('/');
}

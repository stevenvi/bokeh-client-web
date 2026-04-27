<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigationStore } from '$lib/stores/navigation';
	import { toolbarStore } from '$lib/stores/toolbar';
	import { onDestroy } from 'svelte';
	import AlbumGridView from './AlbumGridView.svelte';
	import WaterfallView from './WaterfallView.svelte';

	interface Props {
		collectionId: number;
		collectionName: string;
		parentCollectionId: number | null;
	}

	let { collectionId, collectionName, parentCollectionId }: Props = $props();

	type ViewMode = 'album' | 'waterfall';
	let mode = $state<ViewMode>('album');

	// Set mode from saved state on mount and reset when collection changes.
	$effect(() => {
		mode = (navigationStore.getViewMode(collectionId) as ViewMode) ?? 'album';
	});

	// Project view toolbar into the top bar via store
	$effect(() => {
		toolbarStore.set({
			mode,
			onModeChange: (m) => { mode = m; }
		});
		return () => { toolbarStore.set(null); };
	});

	// Save/restore scroll position and view mode.
	// The actual scrollable element is the layout's overflow container,
	// not the window — see +layout.svelte's #app-scroll.
	onDestroy(() => {
		const container = document.getElementById('app-scroll');
		navigationStore.saveScrollPosition(collectionId, container?.scrollTop ?? 0);
		navigationStore.saveViewMode(collectionId, mode);
	});

	$effect(() => {
		const saved = navigationStore.getScrollPosition(collectionId);
		if (saved == null || saved <= 0) return;
		// The grid/waterfall data loads asynchronously, so on first paint the
		// scroll container may be too short to honor the saved offset. Poll a
		// few frames until content height catches up (or give up after ~1s).
		let attempts = 0;
		let cancelled = false;
		function tryRestore() {
			if (cancelled) return;
			const container = document.getElementById('app-scroll');
			if (!container) return;
			const target = Math.min(saved, container.scrollHeight - container.clientHeight);
			if (target >= saved || attempts++ > 60) {
				container.scrollTo(0, saved);
				return;
			}
			requestAnimationFrame(tryRestore);
		}
		requestAnimationFrame(tryRestore);
		return () => { cancelled = true; };
	});

	function onKeyDown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (mode === 'waterfall') {
			mode = 'album';
			navigationStore.clearViewMode(collectionId);
		} else {
			if (parentCollectionId != null) {
				goto(`/collection/${parentCollectionId}`);
			} else {
				goto(navigationStore.previousPath());
			}
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div>
	{#key collectionId}
		{#if mode === 'album'}
			<AlbumGridView {collectionId} {collectionName} />
		{:else}
			<WaterfallView {collectionId} {collectionName} />
		{/if}
	{/key}
</div>

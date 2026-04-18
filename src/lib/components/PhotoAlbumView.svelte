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

	// Save/restore scroll position and view mode
	onDestroy(() => {
		navigationStore.saveScrollPosition(collectionId, window.scrollY);
		navigationStore.saveViewMode(collectionId, mode);
	});

	$effect(() => {
		const saved = navigationStore.getScrollPosition(collectionId);
		if (saved != null && saved > 0) {
			requestAnimationFrame(() => window.scrollTo(0, saved));
		}
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
				goto('/');
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

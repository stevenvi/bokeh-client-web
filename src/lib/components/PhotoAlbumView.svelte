<script lang="ts">
	import { navigationStore } from '$lib/stores/navigation';
	import { toolbarStore } from '$lib/stores/toolbar';
	import { onDestroy } from 'svelte';
	import AlbumGridView from './AlbumGridView.svelte';
	import WaterfallView from './WaterfallView.svelte';
	import ScrollRestore from './ScrollRestore.svelte';

	interface Props {
		collectionId: number;
		collectionName: string;
	}

	let { collectionId, collectionName }: Props = $props();

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

	// Persist the chosen view mode across navigations.
	onDestroy(() => {
		navigationStore.saveViewMode(collectionId, mode);
	});

</script>

<ScrollRestore path={`/collection/${collectionId}`} />

<div>
	{#key collectionId}
		{#if mode === 'album'}
			<AlbumGridView {collectionId} {collectionName} />
		{:else}
			<WaterfallView {collectionId} {collectionName} />
		{/if}
	{/key}
</div>

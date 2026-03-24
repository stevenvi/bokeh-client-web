<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { getCollection } from '$lib/api/collections';
	import { navigationStore } from '$lib/stores/navigation';
	import PhotoAlbumView from '$lib/components/PhotoAlbumView.svelte';
	import UnsupportedCollectionView from '$lib/components/UnsupportedCollectionView.svelte';

	const collectionId = $derived(Number(page.params.id));

	const collectionQuery = $derived(
		createQuery({
			queryKey: ['collection', collectionId],
			queryFn: () => getCollection(collectionId)
		})
	);

	$effect(() => {
		if ($collectionQuery.data) {
			navigationStore.push({ id: $collectionQuery.data.id, name: $collectionQuery.data.name });
		}
	});

	function onKeyDown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		// Photo collections handle escape in PhotoAlbumView
		if ($collectionQuery.data?.type === 'image:photo') return;
		const parentId = $collectionQuery.data?.parent_collection_id;
		if (parentId != null) {
			goto(`/collection/${parentId}`);
		} else {
			goto('/');
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<svelte:head>
	<title>{$collectionQuery.data?.name ?? 'Collection'} — Bokeh</title>
</svelte:head>

<main class="min-h-dvh bg-bg">
	{#if $collectionQuery.isPending}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if $collectionQuery.isError}
		<p class="text-error p-6">Failed to load collection.</p>
	{:else if $collectionQuery.data}
		{@const collection = $collectionQuery.data}
		{#if collection.type === 'image:photo'}
			<PhotoAlbumView collectionId={collectionId} collectionName={collection.name} parentCollectionId={collection.parent_collection_id} />
		{:else}
			<UnsupportedCollectionView collectionName={collection.name} collectionType={collection.type} />
		{/if}
	{/if}
</main>

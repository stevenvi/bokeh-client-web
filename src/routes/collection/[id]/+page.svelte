<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { getCollection } from '$lib/api/collections';
	import { navigationStore } from '$lib/stores/navigation';
	import PhotoAlbumView from '$lib/components/PhotoAlbumView.svelte';
	import MusicCollectionView from '$lib/components/MusicCollectionView.svelte';
	import MovieCollectionView from '$lib/components/MovieCollectionView.svelte';
	import HomeMovieCollectionView from '$lib/components/HomeMovieCollectionView.svelte';
	import RadioCollectionView from '$lib/components/RadioCollectionView.svelte';
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
			const collection = $collectionQuery.data;
			// Root collections (no parent) start a fresh breadcrumb trail rather than
			// appending to whatever was previously navigated.
			if (collection.parent_collection_id == null) {
				navigationStore.reset();
			}
			navigationStore.push({ id: collection.id, name: collection.name, path: `/collection/${collection.id}` });
		}
	});

	function onKeyDown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		// Photo, music, and show collections handle escape in their own views
		if ($collectionQuery.data?.type === 'image:photo') return;
		if ($collectionQuery.data?.type === 'audio:music') return;
		if ($collectionQuery.data?.type === 'audio:show') return;
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

<main class="min-h-dvh ">
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
		{:else if collection.type === 'audio:music' && collection.parent_collection_id == null}
			<MusicCollectionView collectionId={collectionId} collectionName={collection.name} parentCollectionId={collection.parent_collection_id} />
		{:else if collection.type === 'audio:show' && collection.parent_collection_id == null}
			<RadioCollectionView collectionId={collectionId} collectionName={collection.name} parentCollectionId={collection.parent_collection_id} />
		{:else if collection.type === 'video:movie'}
			<MovieCollectionView {collection} />
		{:else if collection.type === 'video:home_movie'}
			<HomeMovieCollectionView {collection} />
		{:else}
			<UnsupportedCollectionView collectionName={collection.name} collectionType={collection.type} />
		{/if}
	{/if}
</main>

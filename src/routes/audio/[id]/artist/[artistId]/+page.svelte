<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { getCollection } from '$lib/api/collections';
	import { listArtistAlbums } from '$lib/api/music';
	import { applyBreadcrumbs } from '$lib/utils/collectionPath';
	import ArtistView from '$lib/components/ArtistView.svelte';

	const rootCollectionId = $derived(Number(page.params.id));
	const artistId = $derived(Number(page.params.artistId));

	const collectionQuery = $derived(
		createQuery({
			queryKey: ['collection', rootCollectionId],
			queryFn: () => getCollection(rootCollectionId)
		})
	);

	// Same query key as ArtistView — data comes from cache on back-navigation.
	const artistQuery = $derived(
		createQuery({
			queryKey: ['music', 'collection', rootCollectionId, 'artist', artistId, 'albums'],
			queryFn: () => listArtistAlbums(rootCollectionId, artistId)
		})
	);

	$effect(() => {
		const col = $collectionQuery.data;
		const artist = $artistQuery.data?.artist;
		if (!col || !artist) return;
		applyBreadcrumbs([
			{ id: -2, name: 'Audio', path: '/audio' },
			{ id: col.id, name: col.name, path: `/audio/${col.id}` },
			{ id: artistId, name: artist.name, path: `/audio/${col.id}/artist/${artistId}` }
		]);
	});
</script>

<svelte:head>
	<title>Artist — Bokeh</title>
</svelte:head>

<main>
	{#if $collectionQuery.isPending}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if $collectionQuery.isError}
		<p class="text-error p-6">Collection not found.</p>
	{:else}
		<ArtistView {artistId} {rootCollectionId} />
	{/if}
</main>

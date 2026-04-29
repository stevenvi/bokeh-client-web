<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { getCollection } from '$lib/api/collections';
	import { listArtistAlbums } from '$lib/api/music';
	import { applyBreadcrumbs } from '$lib/utils/collectionPath';
	import AlbumTrackListView from '$lib/components/AlbumTrackListView.svelte';

	const rootCollectionId = $derived(Number(page.params.id));
	const artistId = $derived(Number(page.params.artistId));
	const albumId = $derived(Number(page.params.albumId));

	// Fetch collection and artist in parallel for fresh-load breadcrumb population.
	// AlbumTrackListView pushes the album entry itself.
	const collectionQuery = $derived(
		createQuery({
			queryKey: ['collection', rootCollectionId],
			queryFn: () => getCollection(rootCollectionId)
		})
	);

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
	<title>Album — Bokeh</title>
</svelte:head>

<main>
	{#if $collectionQuery.isPending || $artistQuery.isPending}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if $collectionQuery.isError || $artistQuery.isError}
		<p class="text-error p-6">Not found.</p>
	{:else}
		<AlbumTrackListView {albumId} {rootCollectionId} {artistId} />
	{/if}
</main>

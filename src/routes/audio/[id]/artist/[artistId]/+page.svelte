<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { getCollection } from '$lib/api/collections';
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

	// Ensure Audio and collection crumbs exist for fresh loads.
	// ArtistView pushes the artist entry itself once its data loads.
	$effect(() => {
		const col = $collectionQuery.data;
		if (!col) return;
		applyBreadcrumbs([
			{ id: -2, name: 'Audio', path: '/audio' },
			{ id: col.id, name: col.name, path: `/audio/${col.id}` }
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

<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { getCollection } from '$lib/api/collections';
	import { applyBreadcrumbs } from '$lib/utils/collectionPath';
	import MusicCollectionView from '$lib/components/MusicCollectionView.svelte';
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
		const col = $collectionQuery.data;
		if (!col) return;
		applyBreadcrumbs([
			{ id: -2, name: 'Audio', path: '/audio' },
			{ id: col.id, name: col.name, path: `/audio/${col.id}` }
		]);
	});
</script>

<svelte:head>
	<title>{$collectionQuery.data?.name ?? 'Audio'} — Bokeh</title>
</svelte:head>

<main>
	{#if $collectionQuery.isPending}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if $collectionQuery.isError}
		<p class="text-error p-6">Collection not found.</p>
	{:else if $collectionQuery.data}
		{@const collection = $collectionQuery.data}
		{#if collection.type === 'audio:music'}
			<MusicCollectionView {collectionId} />
		{:else if collection.type === 'audio:show'}
			<RadioCollectionView {collectionId} />
		{:else}
			<UnsupportedCollectionView
				collectionName={collection.name}
				collectionType={collection.type}
			/>
		{/if}
	{/if}
</main>

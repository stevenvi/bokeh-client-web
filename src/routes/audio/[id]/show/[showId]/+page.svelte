<script lang="ts">
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { getCollection } from '$lib/api/collections';
	import { applyBreadcrumbs } from '$lib/utils/collectionPath';
	import RadioShowView from '$lib/components/RadioShowView.svelte';

	const rootCollectionId = $derived(Number(page.params.id));
	const showId = $derived(Number(page.params.showId));

	const collectionQuery = $derived(
		createQuery({
			queryKey: ['collection', rootCollectionId],
			queryFn: () => getCollection(rootCollectionId)
		})
	);

	// Establish the full breadcrumb trail immediately when the collection loads,
	// including a placeholder for the show entry. RadioShowView fills in the
	// real show name once its query resolves. Without the placeholder, pressing
	// Escape before the episodes query resolves would navigate to /audio instead
	// of back to the collection.
	$effect(() => {
		const col = $collectionQuery.data;
		if (!col) return;
		applyBreadcrumbs([
			{ id: -2, name: 'Audio', path: '/audio' },
			{ id: col.id, name: col.name, path: `/audio/${col.id}` },
			{ id: showId, name: '', path: `/audio/${col.id}/show/${showId}` }
		]);
	});
</script>

<svelte:head>
	<title>Show — Bokeh</title>
</svelte:head>

<main>
	{#if $collectionQuery.isPending}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if $collectionQuery.isError}
		<p class="text-error p-6">Collection not found.</p>
	{:else}
		<RadioShowView {showId} collectionId={rootCollectionId} />
	{/if}
</main>

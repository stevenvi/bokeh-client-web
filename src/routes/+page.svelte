<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { listCollections } from '$lib/api/collections';
	import { navigationStore } from '$lib/stores/navigation';
	import CollectionTile from '$lib/components/CollectionTile.svelte';
	import AdminCollectionMenu from '$lib/components/AdminCollectionMenu.svelte';
	import { authStore } from '$lib/stores/auth';

	const collectionsQuery = createQuery({
		queryKey: ['collections'],
		queryFn: listCollections
	});

	// Always clear breadcrumb when home page is active (including browser back).
	onMount(() => {
		navigationStore.reset();
	});

	function openCollection(id: number, name: string) {
		goto(`/collection/${id}`);
	}
</script>

<svelte:head>
	<title>Bokeh</title>
</svelte:head>

<main class="min-h-dvh px-4 py-6 pb-safe">
	<h1 class="text-text-primary mb-6 text-2xl font-semibold">Your Library</h1>

	{#if $collectionsQuery.isPending}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each Array(6) as _}
				<div class="animate-pulse">
					<div class="bg-surface-raised aspect-square w-full rounded-lg"></div>
					<div class="bg-surface-raised mt-2 h-4 w-3/4 rounded"></div>
				</div>
			{/each}
		</div>
	{:else if $collectionsQuery.isError}
		<p class="text-error">Failed to load collections. Please try again.</p>
	{:else if $collectionsQuery.data?.length === 0}
		<p class="text-text-muted text-center">
			No collections available. An administrator needs to create and share a collection with you.
		</p>
	{:else}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each $collectionsQuery.data ?? [] as collection (collection.id)}
				<div class="relative">
					<CollectionTile
						id={collection.id}
						name={collection.name}
						type={collection.type}
						onclick={() => openCollection(collection.id, collection.name)}
					/>
					{#if $authStore?.isAdmin}
						<div class="absolute top-1 right-1 z-10" onclick={(e) => e.stopPropagation()}>
							<AdminCollectionMenu collection={collection} />
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</main>

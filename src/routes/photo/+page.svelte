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

	const filtered = $derived(
		$collectionsQuery.data?.filter((c) => c.type.startsWith('image:')) ?? []
	);

	onMount(() => {
		navigationStore.push({ id: -1, name: 'Photos', path: '/photo' });
	});

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') goto(navigationStore.previousPath());
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<svelte:head>
	<title>Photos – Bokeh</title>
</svelte:head>

<main class="min-h-dvh px-4 py-6">
	<h1 class="text-text-primary mb-6 text-2xl font-semibold">Photos</h1>

	{#if $collectionsQuery.isPending}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each Array(4) as _}
				<div class="animate-pulse">
					<div class="bg-surface-raised aspect-square w-full rounded-lg"></div>
					<div class="bg-surface-raised mt-2 h-4 w-3/4 rounded"></div>
				</div>
			{/each}
		</div>
	{:else if $collectionsQuery.isError}
		<p class="text-error">Failed to load collections. Please try again.</p>
	{:else if filtered.length === 0}
		<p class="text-text-muted text-center">No photo collections available.</p>
	{:else}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each filtered as collection (collection.id)}
				<div class="relative">
					<CollectionTile
						id={collection.id}
						name={collection.name}
						type={collection.type}
						date={collection.date}
						onclick={() => goto(`/collection/${collection.id}`)}
					/>
					{#if $authStore?.isAdmin}
						<div class="absolute top-1 right-1 z-10" onclick={(e) => e.stopPropagation()}>
							<AdminCollectionMenu {collection} />
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</main>

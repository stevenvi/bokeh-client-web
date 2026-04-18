<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { listCollections } from '$lib/api/collections';
	import { navigationStore } from '$lib/stores/navigation';
	import CategoryTile from '$lib/components/CategoryTile.svelte';
	import { authStore } from '$lib/stores/auth';

	const collectionsQuery = createQuery({
		queryKey: ['collections'],
		queryFn: listCollections
	});

	// Always clear breadcrumb when home page is active (including browser back).
	onMount(() => {
		navigationStore.reset();
	});

	const hasPhoto = $derived(
		$collectionsQuery.data?.some((c) => c.type.startsWith('image:')) ?? false
	);
	const hasAudio = $derived(
		$collectionsQuery.data?.some((c) => c.type.startsWith('audio:')) ?? false
	);
	const hasVideo = $derived(
		$collectionsQuery.data?.some((c) => c.type.startsWith('video:')) ?? false
	);
	const hasAny = $derived(hasPhoto || hasAudio || hasVideo || ($authStore?.isAdmin ?? false));
</script>

<svelte:head>
	<title>Bokeh</title>
</svelte:head>

<main class="px-4 py-6">
	<h1 class="text-text-primary mb-6 text-2xl font-semibold">Your Library</h1>

	{#if $collectionsQuery.isPending}
		<div class="flex justify-center">
			<div class="grid w-full max-w-sm grid-cols-2 gap-4">
				{#each Array(2) as _}
					<div class="animate-pulse">
						<div class="bg-surface-raised aspect-square w-full rounded-lg"></div>
						<div class="bg-surface-raised mt-2 h-4 w-3/4 rounded"></div>
					</div>
				{/each}
			</div>
		</div>
	{:else if $collectionsQuery.isError}
		<p class="text-error">Failed to load collections. Please try again.</p>
	{:else if !hasAny}
		<p class="text-text-muted text-center">
			No collections available. An administrator needs to create and share a collection with you.
		</p>
	{:else}
		<div class="flex justify-center">
			<div class="grid w-full max-w-sm grid-cols-2 gap-4">
				{#if hasPhoto}
					<CategoryTile category="photo" onclick={() => goto('/photo')} />
				{/if}
				{#if hasAudio}
					<CategoryTile category="audio" onclick={() => goto('/audio')} />
				{/if}
				{#if hasVideo}
					<CategoryTile category="video" onclick={() => goto('/video')} />
				{/if}
				{#if $authStore?.isAdmin}
					<CategoryTile category="admin" onclick={() => goto('/admin')} />
				{/if}
			</div>
		</div>
	{/if}
</main>

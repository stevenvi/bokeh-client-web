<script lang="ts">
	import { page } from '$app/state';
	import { parseCollectionIds, loadCollectionChain, applyBreadcrumbs } from '$lib/utils/collectionPath';
	import MovieCollectionView from '$lib/components/MovieCollectionView.svelte';
	import HomeMovieCollectionView from '$lib/components/HomeMovieCollectionView.svelte';
	import UnsupportedCollectionView from '$lib/components/UnsupportedCollectionView.svelte';
	import type { CollectionView } from '$lib/types';

	const pathParam = $derived(page.params.path ?? '');
	const basePath = $derived('/video/' + pathParam);

	let loadState = $state<'loading' | 'error' | 'loaded'>('loading');
	let leafCollection = $state<CollectionView | null>(null);

	$effect(() => {
		const path = pathParam;
		const ids = parseCollectionIds(path);
		if (!ids) {
			loadState = 'error';
			leafCollection = null;
			return;
		}

		loadState = 'loading';
		leafCollection = null;
		let cancelled = false;

		loadCollectionChain(ids).then((collections) => {
			if (cancelled) return;
			if (!collections) {
				loadState = 'error';
				return;
			}
			const leaf = collections[collections.length - 1];
			applyBreadcrumbs([
				{ id: -3, name: 'Video', path: '/video' },
				...collections.map((col, i) => ({
					id: col.id,
					name: col.name,
					path: '/video/' + ids.slice(0, i + 1).join('/')
				}))
			]);
			leafCollection = leaf;
			loadState = 'loaded';
		});

		return () => { cancelled = true; };
	});
</script>

<svelte:head>
	<title>{leafCollection?.name ?? 'Video'} — Bokeh</title>
</svelte:head>

<main>
	{#if loadState === 'loading'}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if loadState === 'error'}
		<p class="text-error p-6">Collection not found.</p>
	{:else if leafCollection}
		{#if leafCollection.type === 'video:movie'}
			<MovieCollectionView collection={leafCollection} {basePath} />
		{:else if leafCollection.type === 'video:home_movie'}
			<HomeMovieCollectionView collection={leafCollection} {basePath} />
		{:else}
			<UnsupportedCollectionView
				collectionName={leafCollection.name}
				collectionType={leafCollection.type}
			/>
		{/if}
	{/if}
</main>

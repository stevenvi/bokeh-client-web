<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toolbarStore } from '$lib/stores/toolbar';
	import { parseCollectionIds, loadCollectionChain, applyBreadcrumbs } from '$lib/utils/collectionPath';
	import AlbumGridView from '$lib/components/AlbumGridView.svelte';
	import type { CollectionView } from '$lib/types';

	let { children } = $props();

	const pathParam = $derived(page.params.path ?? '');
	const basePath = $derived('/photo/' + pathParam);

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
			if (!collections || !collections[collections.length - 1].type.startsWith('image:')) {
				loadState = 'error';
				return;
			}
			const leaf = collections[collections.length - 1];
			applyBreadcrumbs([
				{ id: -1, name: 'Photos', path: '/photo' },
				...collections.map((col, i) => ({
					id: col.id,
					name: col.name,
					path: '/photo/' + ids.slice(0, i + 1).join('/')
				}))
			]);
			leafCollection = leaf;
			loadState = 'loaded';
		});

		return () => { cancelled = true; };
	});

	$effect(() => {
		if (loadState !== 'loaded') return;
		const bp = basePath;
		toolbarStore.set({
			mode: 'album',
			onModeChange: (m) => { if (m === 'waterfall') goto(bp + '/waterfall'); }
		});
		return () => toolbarStore.set(null);
	});
</script>

<main>
	{#if loadState === 'loading'}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if loadState === 'error'}
		<p class="text-error p-6">Collection not found.</p>
	{:else if leafCollection}
		<AlbumGridView
			collectionId={leafCollection.id}
			collectionName={leafCollection.name}
			{basePath}
		/>
	{/if}
</main>

{@render children?.()}

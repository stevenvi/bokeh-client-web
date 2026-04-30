<script lang="ts">
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { parseCollectionIds, loadCollectionChain, applyBreadcrumbs } from '$lib/utils/collectionPath';
	import SlideshowView from '$lib/components/SlideshowView.svelte';

	const pathParam = $derived(page.params.path ?? '');

	// Read ordinal once — not reactive. The URL uses 1-based ordinals for display;
	// internally startOrdinal is 0-based to match server/item ordinals.
	const startOrdinal = Number(page.params.ordinal) - 1;

	let loadState = $state<'loading' | 'error' | 'loaded'>('loading');
	let collectionId = $state(0);
	let collectionName = $state('');

	$effect(() => {
		const path = pathParam;
		const ids = parseCollectionIds(path);
		if (!ids) {
			loadState = 'error';
			return;
		}

		loadState = 'loading';
		let cancelled = false;

		loadCollectionChain(ids).then((collections) => {
			if (cancelled) return;
			if (!collections || !collections[collections.length - 1].type.startsWith('image:')) {
				loadState = 'error';
				return;
			}
			const leaf = collections[collections.length - 1];
			const slideshowPath = '/photo/' + path + '/slideshow/' + (startOrdinal + 1);
			applyBreadcrumbs([
				{ id: -1, name: 'Photos', path: '/photo' },
				...collections.map((col, i) => ({
					id: col.id,
					name: col.name,
					path: '/photo/' + ids.slice(0, i + 1).join('/')
				})),
				{ id: leaf.id, name: 'Slideshow', path: slideshowPath, hidden: true }
			]);
			collectionId = leaf.id;
			collectionName = leaf.name;
			loadState = 'loaded';
		});

		return () => { cancelled = true; };
	});

	function handleOrdinalChange(ordinal: number) {
		replaceState('/photo/' + pathParam + '/slideshow/' + (ordinal + 1), {});
	}
</script>

<svelte:head><title>Slideshow — Bokeh</title></svelte:head>

{#if loadState === 'error'}
	<p class="text-error p-6">Collection not found.</p>
{:else if loadState === 'loaded'}
	<SlideshowView
		{collectionId}
		{collectionName}
		autoplay={false}
		order="asc"
		recursive={false}
		{startOrdinal}
		onOrdinalChange={handleOrdinalChange}
	/>
{/if}

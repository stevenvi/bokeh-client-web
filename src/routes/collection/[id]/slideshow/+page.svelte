<script lang="ts">
	import { page } from '$app/state';
	import SlideshowView from '$lib/components/SlideshowView.svelte';

	const collectionId = $derived(Number(page.params.id));
	const searchParams = $derived(page.url.searchParams);
	const autoplay = $derived(searchParams.get('autoplay') === 'true');
	const order = $derived((searchParams.get('order') ?? 'asc') as 'asc' | 'desc');
	const recursive = $derived(searchParams.get('recursive') !== 'false');
	const startItem = $derived(
		searchParams.get('start') ? Number(searchParams.get('start')) : null
	);
	const collectionName = $derived(searchParams.get('name') ?? '');

	// Seed items are passed as a JSON-encoded array via the URL query param.
	// This avoids a round-trip when entering slideshow from an already-loaded grid.
	const seedParam = $derived(searchParams.get('seed'));
	const seedItems = $derived(() => {
		if (!seedParam) return [];
		try {
			return JSON.parse(decodeURIComponent(seedParam));
		} catch {
			return [];
		}
	});

	// When seed items are provided, find the start item's index within them.
	const startIndex = $derived(() => {
		if (startItem != null && seedItems().length > 0) {
			const idx = seedItems().findIndex((i: { id: number }) => i.id === startItem);
			return idx >= 0 ? idx : 0;
		}
		return 0;
	});
</script>

<svelte:head>
	<title>Slideshow — Bokeh</title>
</svelte:head>

<SlideshowView
	{collectionId}
	{autoplay}
	{order}
	{recursive}
	{startItem}
	startIndex={startIndex()}
	initialItems={seedItems()}
	{collectionName}
/>

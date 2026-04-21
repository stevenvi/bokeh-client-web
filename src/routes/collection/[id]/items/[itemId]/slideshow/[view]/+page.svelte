<script lang="ts">
	import { page } from '$app/state';
	import SlideshowView from '$lib/components/SlideshowView.svelte';

	const collectionId = $derived(Number(page.params.id));
	const itemId = $derived(Number(page.params.itemId));
	const view = $derived(page.params.view as 'album' | 'waterfall');
	const searchParams = $derived(page.url.searchParams);
	const autoplay = $derived(searchParams.get('autoplay') === 'true');
	const collectionName = $derived(searchParams.get('name') ?? '');

	// View determines query params: album = non-recursive asc, waterfall = recursive desc
	const order = $derived(view === 'waterfall' ? 'desc' : 'asc') as 'asc' | 'desc';
	const recursive = $derived(view === 'waterfall');
</script>

<svelte:head><title>Slideshow — Bokeh</title></svelte:head>

<SlideshowView
	{collectionId}
	{autoplay}
	{order}
	{recursive}
	startItem={itemId}
	{collectionName}
/>

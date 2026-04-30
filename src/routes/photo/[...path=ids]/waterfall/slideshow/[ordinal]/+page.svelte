<script lang="ts">
	import { page } from '$app/state';
	import SlideshowPage from '$lib/components/SlideshowPage.svelte';

	const pathParam = $derived(page.params.path ?? '');
	const startOrdinal = Number(page.params.ordinal) - 1;

	const waterfallPath = $derived('/photo/' + pathParam + '/waterfall');
</script>

<SlideshowPage
	path={pathParam}
	{startOrdinal}
	slideshowUrlPrefix={waterfallPath + '/slideshow/'}
	extraBreadcrumbs={[{ id: 0, name: 'Waterfall', path: waterfallPath }]}
	order="desc"
	recursive={true}
	onOrdinalChange={(ordinal) => history.replaceState({ ...history.state }, '', waterfallPath + '/slideshow/' + (ordinal + 1))}
/>

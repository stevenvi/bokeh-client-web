<script lang="ts">
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import SlideshowPage from '$lib/components/SlideshowPage.svelte';

	const pathParam = $derived(page.params.path ?? '');
	const startOrdinal = Number(page.params.ordinal) - 1;
</script>

<SlideshowPage
	path={pathParam}
	{startOrdinal}
	slideshowUrlPrefix={'/photo/' + pathParam + '/slideshow/'}
	order="asc"
	recursive={false}
	onOrdinalChange={(ordinal) => replaceState('/photo/' + pathParam + '/slideshow/' + (ordinal + 1), {})}
/>

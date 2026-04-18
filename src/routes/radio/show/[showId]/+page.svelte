<script lang="ts">
	import { page } from '$app/state';
	import RadioShowView from '$lib/components/RadioShowView.svelte';

	const showId = $derived(Number(page.params.showId));
	const collectionId = $derived(Number(page.url.searchParams.get('collection') ?? '0'));
</script>

<svelte:head>
	<title>Radio Shows — Bokeh</title>
</svelte:head>

<main class="min-h-dvh">
	<RadioShowView {showId} {collectionId} />
</main>

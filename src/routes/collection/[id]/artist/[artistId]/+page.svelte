<script lang="ts">
	import { page } from '$app/state';
	import { navigationStore } from '$lib/stores/navigation';
	import ArtistView from '$lib/components/ArtistView.svelte';

	const rootCollectionId = $derived(Number(page.params.id));
	const artistId = $derived(Number(page.params.artistId));
</script>

<svelte:head>
	<title>Artist — Bokeh</title>
</svelte:head>

<main class="min-h-dvh ">
	<ArtistView {artistId} {rootCollectionId} />
</main>

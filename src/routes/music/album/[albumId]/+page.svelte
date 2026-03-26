<script lang="ts">
	import { page } from '$app/state';
	import AlbumTrackListView from '$lib/components/AlbumTrackListView.svelte';

	const albumId = $derived(Number(page.params.albumId));
	const rootCollectionId = $derived(Number(page.url.searchParams.get('collection') ?? '0'));
</script>

<svelte:head>
	<title>Album — Bokeh</title>
</svelte:head>

<main class="min-h-dvh bg-bg">
	<AlbumTrackListView {albumId} {rootCollectionId} />
</main>

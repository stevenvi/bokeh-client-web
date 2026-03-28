<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { createQuery } from '@tanstack/svelte-query';
	import { getMediaItem } from '$lib/api/media';
	import { getCollection } from '$lib/api/collections';
	import { videoCoverUrl } from '$lib/api/video';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';

	const itemId = $derived(Number(page.params.id));

	// Fetch item details — used when navigating directly to this URL
	const itemQuery = $derived(
		createQuery({
			queryKey: ['media', itemId],
			queryFn: () => getMediaItem(itemId),
			enabled: itemId > 0
		})
	);

	// Once we have the item, fetch its collection for name + type
	const collectionId = $derived($itemQuery.data?.collection_id ?? null);
	const collectionQuery = $derived(
		createQuery({
			queryKey: ['collection', collectionId],
			queryFn: () => getCollection(collectionId!),
			enabled: collectionId != null
		})
	);

	// When item + collection are loaded, start playback if not already playing this item
	$effect(() => {
		const item = $itemQuery.data;
		const col = $collectionQuery.data;
		const state = $mediaPlayer;

		if (!item || !col) return;
		if (state.itemId === item.id) {
			// Already playing — just ensure full player mode is set
			mediaPlayer.setIsFullPlayer(true);
			return;
		}

		mediaPlayer.playVideo({
			itemId: item.id,
			title: item.title,
			collectionId: col.id,
			collectionName: col.name,
			collectionType: col.type,
			bookmarkSeconds: item.video?.bookmark_seconds ?? null,
			thumbnailUrl: videoCoverUrl(item.id)
		});
		mediaPlayer.setIsFullPlayer(true);
	});

	// Ensure full player mode whenever this page is mounted
	$effect(() => {
		mediaPlayer.setIsFullPlayer(true);
	});

	onDestroy(() => {
		mediaPlayer.setIsFullPlayer(false);
	});
</script>

<svelte:head>
	<title>{$mediaPlayer.title || $itemQuery.data?.title || 'Watch'} — Bokeh</title>
</svelte:head>

<!-- The watch page renders no visible content of its own.
     MediaPlayer.svelte handles all UI when isFullPlayer is true. -->
<div class="h-dvh bg-black"></div>

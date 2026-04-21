<script lang="ts">
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { getCollection } from '$lib/api/collections';
	import { videoCoverUrl } from '$lib/api/video';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';

	const collectionId = $derived(Number(page.params.id));
	const itemId = $derived(Number(page.params.itemId));

	const collectionQuery = $derived(
		createQuery({
			queryKey: ['collection', collectionId],
			queryFn: () => getCollection(collectionId),
			enabled: collectionId > 0
		})
	);

	$effect(() => {
		const col = $collectionQuery.data;
		const state = $mediaPlayer;
		if (!col) return;
		if (state.itemId === itemId) {
			mediaPlayer.setIsFullPlayer(true);
			return;
		}
		mediaPlayer.playVideo({
			itemId,
			title: '',
			collectionId: col.id,
			collectionName: col.name,
			collectionType: col.type,
			bookmarkSeconds: null,
			thumbnailUrl: videoCoverUrl(itemId)
		});
		mediaPlayer.setIsFullPlayer(true);
	});

	$effect(() => {
		mediaPlayer.setIsFullPlayer(true);
	});

	function goToCollection() {
		const id = $mediaPlayer.collectionId ?? collectionId;
		if (id != null) goto(`/collection/${id}`);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') goToCollection();
	}

	function onFullscreenChange() {
		if (!document.fullscreenElement) goToCollection();
	}

	onMount(() => {
		document.addEventListener('fullscreenchange', onFullscreenChange);
	});

	onDestroy(() => {
		document.removeEventListener('fullscreenchange', onFullscreenChange);
		mediaPlayer.setIsFullPlayer(false);
	});
</script>

<svelte:window onkeydown={onKeyDown} />
<svelte:head><title>{$mediaPlayer.title || 'Watch'} — Bokeh</title></svelte:head>
<div class="h-dvh bg-black"></div>

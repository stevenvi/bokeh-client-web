<script lang="ts">
	import { page } from '$app/state';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { getCollection } from '$lib/api/collections';
	import { videoCoverUrl } from '$lib/api/video';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import { parseCollectionIds, loadCollectionChain, applyBreadcrumbs } from '$lib/utils/collectionPath';
	import { useBreadcrumb, goBack } from '$lib/utils/breadcrumb.svelte';

	const pathParam = $derived(page.params.path ?? '');
	const itemId = $derived(Number(page.params.itemId));
	const basePath = $derived('/video/' + pathParam);
	const watchPath = $derived(basePath + '/watch/' + itemId);

	useBreadcrumb(() => ({
		id: itemId,
		name: 'Watch',
		path: watchPath,
		hidden: true
	}));

	// Ensure the ancestor breadcrumb trail is populated on fresh loads
	$effect(() => {
		const path = pathParam;
		const ids = parseCollectionIds(path);
		if (!ids) return;
		let cancelled = false;
		loadCollectionChain(ids).then((collections) => {
			if (cancelled || !collections) return;
			applyBreadcrumbs([
				{ id: -3, name: 'Video', path: '/video' },
				...collections.map((col, i) => ({
					id: col.id,
					name: col.name,
					path: '/video/' + ids.slice(0, i + 1).join('/')
				})),
				{ id: itemId, name: 'Watch', path: '/video/' + path + '/watch/' + itemId, hidden: true }
			]);
		});
		return () => { cancelled = true; };
	});

	const collectionQuery = $derived(
		createQuery({
			queryKey: ['collection', Number((pathParam.split('/').filter(Boolean).at(-1) ?? '0'))],
			queryFn: () => {
				const ids = parseCollectionIds(pathParam);
				const leafId = ids?.[ids.length - 1] ?? 0;
				return getCollection(leafId);
			},
			enabled: !!pathParam
		})
	);

	$effect(() => {
		const col = $collectionQuery.data;
		if (!col) return;
		untrack(() => {
			const state = $mediaPlayer;
			if (state.itemId === itemId) {
				mediaPlayer.setIsFullPlayer(true);
				return;
			}
			const bp = basePath;
			const wp = watchPath;
			mediaPlayer.playVideo({
				itemId,
				title: '',
				collectionId: col.id,
				collectionName: col.name,
				collectionType: col.type,
				bookmarkSeconds: null,
				thumbnailUrl: videoCoverUrl(itemId),
				collectionPath: bp,
				watchPath: wp
			});
			mediaPlayer.setIsFullPlayer(true);
		});
	});

	function onFullscreenChange() {
		if (!document.fullscreenElement) goBack();
	}

	onMount(() => {
		document.addEventListener('fullscreenchange', onFullscreenChange);
	});

	onDestroy(() => {
		document.removeEventListener('fullscreenchange', onFullscreenChange);
		mediaPlayer.setIsFullPlayer(false);
	});
</script>

<svelte:head><title>{$mediaPlayer.title || 'Watch'} — Bokeh</title></svelte:head>
<div class="h-dvh bg-black"></div>

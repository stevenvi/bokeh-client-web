<script lang="ts">
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { listVideos } from '$lib/api/collections';
	import { videoCoverUrl } from '$lib/api/video';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import type { CollectionView, VideoItemView } from '$lib/types';
	import AdminTileMenu from './AdminTileMenu.svelte';
	import ScrollRestore from './ScrollRestore.svelte';
	import VideoTile from './VideoTile.svelte';
	import { authStore } from '$lib/stores/auth';
	import { adminCreateJob, adminUploadVideoCover } from '$lib/api/admin';
	import { bumpVideoCoverBust } from '$lib/stores/coverBust';
	import { toastStore } from '$lib/stores/toast';

	interface Props {
		collection: CollectionView;
		basePath: string;
	}

	let { collection, basePath }: Props = $props();

	// Server auto-adds include_descendants for video:movie type
	const itemsQuery = $derived(
		createQuery({
			queryKey: ['collection', collection.id, 'videos'],
			queryFn: () => listVideos(collection.id, 1, 200)
		})
	);

	const items = $derived($itemsQuery.data?.items ?? []);

	function onCardClick(item: VideoItemView) {
		const wp = `${basePath}/watch/${item.id}`;
		if ($mediaPlayer.type === 'video' && $mediaPlayer.itemId === item.id) {
			goto(wp);
			return;
		}
		mediaPlayer.playVideo({
			itemId: item.id,
			title: item.title,
			collectionId: collection.id,
			collectionName: collection.name,
			collectionType: collection.type,
			bookmarkSeconds: item.bookmark_seconds ?? null,
			thumbnailUrl: videoCoverUrl(item.id),
			collectionPath: basePath,
			watchPath: wp
		});
		goto(wp);
	}
</script>

<ScrollRestore path={basePath} />

<div class="p-4">
	{#if $itemsQuery.isPending}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if $itemsQuery.isError}
		<p class="text-error p-6">Failed to load movies.</p>
	{:else if items.length === 0}
		<p class="text-text-secondary p-6 text-center">No movies found.</p>
	{:else}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each items as item (item.id)}
				<div class="relative">
					<VideoTile
						id={item.id}
						title={item.title}
						date={item.date ?? null}
						aspectRatio="2/3"
						bookmarkSeconds={item.bookmark_seconds ?? null}
						durationSeconds={item.duration_seconds ?? null}
						onclick={() => onCardClick(item)}
					/>
					{#if $authStore?.isAdmin}
						<div class="absolute top-1 right-1 z-10" onclick={(e) => e.stopPropagation()}>
							<AdminTileMenu items={[
								{ emoji: '🔃', label: 'Rescan Thumbnails', action: async () => { const r = await adminCreateJob('thumbnail_scan', collection.id, 'collection'); toastStore.show(`Thumbnail scan job #${r.id} queued.`); } },
								{ emoji: '🖼', label: 'Upload Image', fileAccept: 'image/*', onFile: async (f) => { await adminUploadVideoCover(item.id, f); bumpVideoCoverBust(item.id); toastStore.show('Image updated.'); } }
							]} />
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

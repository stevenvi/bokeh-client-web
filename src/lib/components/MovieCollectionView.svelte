<script lang="ts">
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { listItems } from '$lib/api/collections';
	import { videoCoverUrl } from '$lib/api/video';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import type { CollectionView, MediaItemView } from '$lib/types';
	import AdminTileMenu from './AdminTileMenu.svelte';
	import { authStore } from '$lib/stores/auth';
	import { adminCreateJob, adminUploadVideoCover } from '$lib/api/admin';
	import { videoCoverBust, bumpVideoCoverBust } from '$lib/stores/coverBust';
	import { toastStore } from '$lib/stores/toast';

	interface Props {
		collection: CollectionView;
	}

	let { collection }: Props = $props();

	// Server auto-adds include_descendants for video:movie type
	const itemsQuery = $derived(
		createQuery({
			queryKey: ['collection', collection.id, 'items'],
			queryFn: () => listItems(collection.id, 1, 200)
		})
	);

	const items = $derived($itemsQuery.data?.items ?? []);

	function formatYear(item: MediaItemView): string | null {
		const date = item.video?.date;
		if (!date) return null;
		return date.slice(0, 4);
	}

	function progressPercent(item: MediaItemView): number | null {
		const bookmark = item.video?.bookmark_seconds;
		const duration = item.video?.duration_seconds;
		if (bookmark == null || !duration) return null;
		return Math.min(100, (bookmark / duration) * 100);
	}

	function onCardClick(item: MediaItemView) {
		if ($mediaPlayer.type === 'video' && $mediaPlayer.itemId === item.id) {
			goto(`/watch/${item.id}`);
			return;
		}
		mediaPlayer.playVideo({
			itemId: item.id,
			title: item.title,
			collectionId: collection.id,
			collectionName: collection.name,
			collectionType: collection.type,
			bookmarkSeconds: item.video?.bookmark_seconds ?? null,
			thumbnailUrl: videoCoverUrl(item.id)
		});
		goto(`/watch/${item.id}`);
	}
</script>

<div class="p-4">
	{#if $itemsQuery.isPending}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if $itemsQuery.isError}
		<p class="text-error p-6">Failed to load movies.</p>
	{:else if items.length === 0}
		<p class="text-text-muted p-6 text-center">No movies found.</p>
	{:else}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
			{#each items as item (item.id)}
				{@const pct = progressPercent(item)}
				{@const year = formatYear(item)}
				<div class="relative">
					<button
						class="group flex w-full flex-col text-left"
						onclick={() => onCardClick(item)}
					>
						<!-- Poster (2:3 aspect ratio) -->
						<div class="relative w-full overflow-hidden rounded-lg bg-surface-raised" style="aspect-ratio: 2/3">
							<!-- Placeholder icon shown when no cover (sits behind the img) -->
							<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
								<svg class="text-text-muted h-12 w-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14m0 0V10m0 4H5a2 2 0 01-2-2v-4a2 2 0 012-2h10v8z" />
								</svg>
							</div>
							{#key $videoCoverBust[item.id]}
								<img
									src={videoCoverUrl(item.id) + ($videoCoverBust[item.id] ? `?v=${$videoCoverBust[item.id]}` : '')}
									alt=""
									class="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
									onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
								/>
							{/key}
							<!-- Progress bar -->
							{#if pct != null}
								<div class="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
									<div class="h-full bg-red-500" style="width: {pct}%"></div>
								</div>
							{/if}
						</div>
						<!-- Title + year -->
						<p class="text-text-primary text-shadow-dark mt-2 truncate text-sm font-medium">{item.title}</p>
						{#if year}
							<p class="text-text-muted text-xs">{year}</p>
						{/if}
					</button>
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

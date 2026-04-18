<script lang="ts">
	import { goto } from '$app/navigation';
	import { createQuery } from '@tanstack/svelte-query';
	import { listItems, listChildCollections } from '$lib/api/collections';
	import { videoCoverUrl } from '$lib/api/video';
	import { collectionCoverUrl } from '$lib/api/media';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import { navigationStore } from '$lib/stores/navigation';
	import type { CollectionView, MediaItemView } from '$lib/types';
	import AdminTileMenu from './AdminTileMenu.svelte';
	import { authStore } from '$lib/stores/auth';
	import { adminCreateJob, adminUploadCollectionCover, adminUploadVideoCover } from '$lib/api/admin';
	import { coverBustStore, bumpCoverBust, videoCoverBust, bumpVideoCoverBust } from '$lib/stores/coverBust';
	import { toastStore } from '$lib/stores/toast';

	interface Props {
		collection: CollectionView;
	}

	let { collection }: Props = $props();

	const childCollectionsQuery = $derived(
		createQuery({
			queryKey: ['collection', collection.id, 'collections'],
			queryFn: () => listChildCollections(collection.id)
		})
	);

	// Fetch items for current collection only (non-recursive)
	const itemsQuery = $derived(
		createQuery({
			queryKey: ['collection', collection.id, 'items', 'local'],
			queryFn: () => listItems(collection.id, 1, 200)
		})
	);

	const childCollections = $derived($childCollectionsQuery.data ?? []);
	const items = $derived($itemsQuery.data?.items ?? []);

	function formatDate(item: MediaItemView): string | null {
		const date = item.video?.date;
		const endDate = item.video?.end_date;
		if (!date) return null;

		// Parse date components
		const parts = date.split('-');
		const year = parts[0];
		const month = parts[1] ? parseInt(parts[1], 10) : null;
		const day = parts[2] ? parseInt(parts[2], 10) : null;

		const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
			'July', 'August', 'September', 'October', 'November', 'December'];
		const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
			'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

		if (!month) return year;

		if (!day) {
			return `${monthNames[month - 1]} ${year}`;
		}

		// Has end date?
		if (endDate) {
			const eParts = endDate.split('-');
			const eMonth = eParts[1] ? parseInt(eParts[1], 10) : null;
			const eDay = eParts[2] ? parseInt(eParts[2], 10) : null;
			if (eMonth && eDay) {
				return `${monthAbbr[month - 1]} ${day}–${eDay}, ${year}`;
			}
		}

		return `${monthNames[month - 1]} ${day}, ${year}`;
	}

	function progressPercent(item: MediaItemView): number | null {
		const bookmark = item.video?.bookmark_seconds;
		const duration = item.video?.duration_seconds;
		if (bookmark == null || !duration) return null;
		return Math.min(100, (bookmark / duration) * 100);
	}

	function onVideoClick(item: MediaItemView) {
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

	function onCollectionClick(collectionId: number, collectionName: string) {
		navigationStore.push({ id: collectionId, name: collectionName, path: `/collection/${collectionId}` });
		goto(`/collection/${collectionId}`);
	}
</script>

<div class="min-h-dvh p-4">
	{#if $childCollectionsQuery.isPending || $itemsQuery.isPending}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if $childCollectionsQuery.isError || $itemsQuery.isError}
		<p class="text-error p-6">Failed to load content.</p>
	{:else}
		<!-- Sub-collections -->
		{#if childCollections.length > 0}
			<div class="mb-6">
				<h2 class="text-text-muted mb-3 text-xs font-semibold uppercase tracking-wide">Collections</h2>
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
					{#each childCollections as col (col.id)}
						<div class="relative">
							<button
								class="group flex w-full flex-col text-left"
								onclick={() => onCollectionClick(col.id, col.name)}
							>
								<div class="relative w-full overflow-hidden rounded-lg bg-surface-raised" style="aspect-ratio: 4/3">
									<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
										<svg class="text-text-muted h-10 w-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
										</svg>
									</div>
									{#key $coverBustStore[col.id]}
										<img
											src={collectionCoverUrl(col.id) + ($coverBustStore[col.id] ? `?v=${$coverBustStore[col.id]}` : '')}
											alt=""
											class="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
											onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
										/>
									{/key}
								</div>
								<p class="text-text-primary mt-2 truncate text-sm font-medium">{col.name}</p>
							</button>
							{#if $authStore?.isAdmin}
								<div class="absolute top-1 right-1 z-10" onclick={(e) => e.stopPropagation()}>
									<AdminTileMenu items={[
										{ emoji: '🔄', label: 'Rescan Library', action: async () => { const r = await adminCreateJob('collection_scan', col.id, 'collection'); toastStore.show(`Scan job #${r.id} queued.`); } },
										{ emoji: '🔃', label: 'Rescan Thumbnails', action: async () => { const r = await adminCreateJob('thumbnail_scan', col.id, 'collection'); toastStore.show(`Thumbnail scan job #${r.id} queued.`); } },
										{ emoji: '🖼', label: 'Upload Cover Image', fileAccept: 'image/*', onFile: async (f) => { await adminUploadCollectionCover(col.id, f); bumpCoverBust(col.id); toastStore.show('Cover updated.'); } }
									]} />
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Video items -->
		{#if items.length > 0}
			{#if childCollections.length > 0}
				<h2 class="text-text-muted mb-3 text-xs font-semibold uppercase tracking-wide">Videos</h2>
			{/if}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{#each items as item (item.id)}
					{@const pct = progressPercent(item)}
					{@const dateStr = formatDate(item)}
					<div class="relative">
						<button
							class="group flex w-full flex-col text-left"
							onclick={() => onVideoClick(item)}
						>
							<!-- 3:4 thumbnail -->
							<div class="relative w-full overflow-hidden rounded-lg bg-surface-raised" style="aspect-ratio: 4/3">
								<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
									<svg class="text-text-muted h-10 w-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
								{#if pct != null}
									<div class="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
										<div class="h-full bg-red-500" style="width: {pct}%"></div>
									</div>
								{/if}
							</div>
							<p class="text-text-primary mt-2 truncate text-sm font-medium">{item.title}</p>
							{#if dateStr}
								<p class="text-text-muted text-xs truncate">{dateStr}</p>
							{/if}
							{#if item.video?.author}
								<p class="text-text-muted text-xs truncate">{item.video.author}</p>
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

		{#if childCollections.length === 0 && items.length === 0}
			<p class="text-text-muted p-6 text-center">No content found.</p>
		{/if}
	{/if}
</div>

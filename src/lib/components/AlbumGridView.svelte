<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { listChildCollections, photoStats } from '$lib/api/collections';
	import { slideshowStore } from '$lib/stores/slideshow';
	import CollectionTile from './CollectionTile.svelte';
	import AdminTileMenu from './AdminTileMenu.svelte';
	import ConfirmPopup from './ConfirmPopup.svelte';
	import MediaGrid from './MediaGrid.svelte';
	import ScrollRestore from './ScrollRestore.svelte';
	import type { PhotoItem } from '$lib/types';
	import { authStore } from '$lib/stores/auth';
	import { adminCreateJob, adminUploadCollectionCover, adminDeleteCollectionCover } from '$lib/api/admin';
	import { collectionCoverUrl } from '$lib/api/media';
	import { coverBustStore, bumpCoverBust } from '$lib/stores/coverBust';
	import { toastStore } from '$lib/stores/toast';

	interface Props {
		collectionId: number;
		collectionName: string;
		basePath: string;
	}

	let { collectionId, collectionName, basePath }: Props = $props();

	const childQuery = $derived(
		createQuery({
			queryKey: ['collections', collectionId, 'children'],
			queryFn: () => listChildCollections(collectionId)
		})
	);

	const statsQuery = $derived(
		createQuery({
			queryKey: ['photoStats', collectionId, 'non-recursive'],
			queryFn: () => photoStats(collectionId, false)
		})
	);

	function openChild(id: number) {
		goto(`${basePath}/${id}`);
	}

	function handleItemClick(item: PhotoItem, _index: number) {
		slideshowStore.set({
			collectionId,
			items: [item],
			total: $statsQuery.data?.total ?? 0,
			params: { sortOrder: 'asc', recursive: false }
		});
		goto(`${basePath}/slideshow/${item.ordinal + 1}`);
	}

	let removeCoverTarget = $state<{ id: number; name: string } | null>(null);

	async function handleRemoveChildCover() {
		const target = removeCoverTarget;
		if (!target) return;
		try {
			await adminDeleteCollectionCover(target.id);
			bumpCoverBust(target.id);
			toastStore.show('Cover removed.');
		} catch (e: unknown) {
			toastStore.show(e instanceof Error ? e.message : 'Failed to remove cover.');
		} finally {
			removeCoverTarget = null;
		}
	}
</script>

<div>
	{#if $childQuery.data && $childQuery.data.length > 0}
		<div class="px-4 py-4">
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{#each $childQuery.data as child (child.id)}
					<div class="relative">
						<CollectionTile
							id={child.id}
							name={child.name}
							type={child.type}
							date={child.date}
							onclick={() => openChild(child.id)}
						/>
						{#if $authStore?.isAdmin}
							<div class="absolute top-1 right-1 z-10" onclick={(e) => e.stopPropagation()}>
								<AdminTileMenu items={[
									{ emoji: '🔄', label: 'Rescan Library', action: async () => { const r = await adminCreateJob('collection_scan', child.id, 'collection'); toastStore.show(`Scan job #${r.id} queued.`); } },
									{ emoji: '🖼', label: 'Rescan Thumbnails', action: async () => { const r = await adminCreateJob('thumbnail_scan', child.id, 'collection'); toastStore.show(`Thumbnail scan job #${r.id} queued.`); } },
									{ emoji: '🖼', label: 'Upload Cover Image', fileAccept: 'image/*', onFile: async (f) => { await adminUploadCollectionCover(child.id, f); bumpCoverBust(child.id); toastStore.show('Cover updated.'); } },
									{ emoji: '🗑', label: 'Remove Cover Image', action: () => { removeCoverTarget = { id: child.id, name: child.name }; } }
								]} />
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<MediaGrid {collectionId} onItemClick={handleItemClick} suppressEmpty={!!($childQuery.data?.length)} />
</div>

{#if removeCoverTarget}
	<ConfirmPopup
		title="Remove Cover Image — {removeCoverTarget.name}"
		message="Remove the cover image for this collection?"
		imageUrl={collectionCoverUrl(removeCoverTarget.id) + ($coverBustStore[removeCoverTarget.id] ? `?v=${$coverBustStore[removeCoverTarget.id]}` : '')}
		imageAlt={removeCoverTarget.name}
		confirmLabel="Remove"
		destructive={true}
		onConfirm={handleRemoveChildCover}
		onCancel={() => (removeCoverTarget = null)}
	/>
{/if}

<ScrollRestore path={basePath} />

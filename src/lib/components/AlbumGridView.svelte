<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { listChildCollections } from '$lib/api/collections';
	import { navigationStore } from '$lib/stores/navigation';
	import CollectionTile from './CollectionTile.svelte';
	import MediaGrid from './MediaGrid.svelte';
	import type { MediaItemView } from '$lib/types';

	interface Props {
		collectionId: number;
		collectionName: string;
	}

	let { collectionId, collectionName }: Props = $props();

	const childQuery = $derived(
		createQuery({
			queryKey: ['collections', collectionId, 'children'],
			queryFn: () => listChildCollections(collectionId)
		})
	);

	function openChild(id: number, name: string) {
		navigationStore.push({ id, name });
		goto(`/collection/${id}`);
	}

	function handleItemClick(item: MediaItemView, _index: number) {
		goto(
			`/collection/${collectionId}/slideshow?autoplay=false&order=asc&recursive=false&start=${item.id}&name=${encodeURIComponent(collectionName)}`
		);
	}
</script>

<div>
	{#if $childQuery.data && $childQuery.data.length > 0}
		<div class="px-4 py-4">
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{#each $childQuery.data as child (child.id)}
					<CollectionTile
						id={child.id}
						name={child.name}
						type={child.type}
						onclick={() => openChild(child.id, child.name)}
					/>
				{/each}
			</div>
		</div>
	{/if}

	<MediaGrid {collectionId} onItemClick={handleItemClick} />
</div>

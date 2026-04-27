<script lang="ts">
	import { createInfiniteQuery, createQuery } from '@tanstack/svelte-query';
	import { listPhotos, photoStats } from '$lib/api/collections';
	import MediaTile from './MediaTile.svelte';
	import type { PhotoItem } from '$lib/types';

	interface Props {
		collectionId: number;
		onItemClick: (item: PhotoItem, index: number) => void;
		suppressEmpty?: boolean;
	}

	let { collectionId, onItemClick, suppressEmpty = false }: Props = $props();

	const statsQuery = $derived(
		createQuery({
			queryKey: ['photoStats', collectionId],
			queryFn: () => photoStats(collectionId, false)
		})
	);

	const itemsQuery = $derived(
		createInfiniteQuery({
			queryKey: ['photos', collectionId],
			queryFn: ({ pageParam }) =>
				listPhotos(collectionId, {
					recursive: false,
					sortOrder: 'asc',
					offset: pageParam as number,
					limit: 50
				}),
			initialPageParam: 0,
			getNextPageParam: (lastPage, allPages) => {
				const total = $statsQuery.data?.total;
				if (total != null && allPages.flatMap((p) => p.items).length >= total) return undefined;
				return lastPage.items.length < lastPage.limit
					? undefined
					: lastPage.offset + lastPage.limit;
			}
		})
	);

	const allItems = $derived(($itemsQuery.data?.pages ?? []).flatMap((page) => page.items));

	let sentinel: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (
					entry.isIntersecting &&
					$itemsQuery.hasNextPage &&
					!$itemsQuery.isFetchingNextPage
				) {
					$itemsQuery.fetchNextPage();
				}
			},
			{ rootMargin: '300px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

{#if $itemsQuery.isPending}
	<div class="grid grid-cols-3 gap-0.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
		{#each Array(12) as _}
			<div class="aspect-square bg-surface-raised animate-pulse"></div>
		{/each}
	</div>
{:else if $itemsQuery.isError}
	<p class="text-error px-4 py-6">Failed to load items.</p>
{:else if allItems.length === 0 && !suppressEmpty}
	<p class="text-text-secondary px-4 py-6 text-sm">No items in this collection.</p>
{:else}
	<div class="grid grid-cols-3 gap-0.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
		{#each allItems as item, i (item.id)}
			<MediaTile
				id={item.id}
				title={item.title}
				hasVariants={item.variants_generated_at != null}
				onclick={() => onItemClick(item, i)}
			/>
		{/each}
	</div>
	<div bind:this={sentinel} class="h-1"></div>
	{#if $itemsQuery.isFetchingNextPage}
		<div class="flex justify-center py-4">
			<div class="border-accent h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{/if}
{/if}

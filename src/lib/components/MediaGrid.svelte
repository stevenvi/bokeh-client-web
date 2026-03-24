<script lang="ts">
	import { createInfiniteQuery } from '@tanstack/svelte-query';
	import { listItems } from '$lib/api/collections';
	import MediaTile from './MediaTile.svelte';
	import type { MediaItemView } from '$lib/types';

	interface Props {
		collectionId: number;
		onItemClick: (item: MediaItemView, index: number) => void;
	}

	let { collectionId, onItemClick }: Props = $props();

	const itemsQuery = $derived(
		createInfiniteQuery({
			queryKey: ['items', collectionId],
			queryFn: ({ pageParam }) => listItems(collectionId, pageParam as number),
			initialPageParam: 1,
			getNextPageParam: (lastPage) =>
				lastPage.next_page != null ? lastPage.next_page : undefined
		})
	);

	const allItems = $derived(
		($itemsQuery.data?.pages ?? []).flatMap((page) => page.items)
	);

	let sentinel: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting && $itemsQuery.hasNextPage && !$itemsQuery.isFetchingNextPage) {
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
{:else if allItems.length === 0}
	<p class="text-text-muted px-4 py-6 text-sm">No items in this collection.</p>
{:else}
	<div class="grid grid-cols-3 gap-0.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
		{#each allItems as item, i (item.id)}
			<MediaTile
				id={item.id}
				title={item.title}
				placeholder={item.photo?.placeholder ?? null}
				hasVariants={item.photo?.variants_generated_at != null}
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

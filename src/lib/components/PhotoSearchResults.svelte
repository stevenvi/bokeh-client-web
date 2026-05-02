<script lang="ts">
	import { createInfiniteQuery } from '@tanstack/svelte-query';
	import { searchPhotos } from '$lib/api/search';
	import { getPhotoColumnCount } from '$lib/utils/photoColumnCount';
	import PhotoColumnGrid from './PhotoColumnGrid.svelte';
	import SearchResultsEmpty from './SearchResultsEmpty.svelte';
	import SlideshowView from './SlideshowView.svelte';
	import type { PhotoItem } from '$lib/types';

	interface Props {
		q: string;
		loading: boolean;
	}

	let { q, loading = $bindable() }: Props = $props();

	const query = $derived(
		createInfiniteQuery({
			queryKey: ['search', 'photos', q],
			queryFn: ({ pageParam }) => searchPhotos(q, (pageParam as number) ?? 0, 200),
			initialPageParam: 0,
			getNextPageParam: (lastPage) =>
				lastPage.items.length < lastPage.limit
					? undefined
					: lastPage.offset + lastPage.items.length
		})
	);

	const allItems = $derived(($query.data?.pages ?? []).flatMap((p) => p.items));

	let columnCount = $state(getPhotoColumnCount());

	$effect(() => {
		function onResize() {
			columnCount = getPhotoColumnCount();
		}
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	let sentinel: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting && $query.hasNextPage && !$query.isFetchingNextPage) {
					$query.fetchNextPage();
				}
			},
			{ rootMargin: '300px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	$effect(() => {
		loading = $query.isFetching;
	});

	let slideshowStartOrdinal: number | null = $state(null);
	let slideshowItems: PhotoItem[] = $state([]);

	function handleClick(item: PhotoItem) {
		slideshowItems = allItems as PhotoItem[];
		slideshowStartOrdinal = item.ordinal;
	}

	function closeSlideshow() {
		slideshowStartOrdinal = null;
	}
</script>

{#if slideshowStartOrdinal !== null}
	<SlideshowView
		externalItems={slideshowItems}
		collectionName=""
		autoplay={false}
		order="asc"
		recursive={false}
		startOrdinal={slideshowStartOrdinal}
		showCounter={false}
		onClose={closeSlideshow}
	/>
{/if}

{#if $query.isPending}
	<div class="flex h-48 items-center justify-center">
		<div
			class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
		></div>
	</div>
{:else if $query.isError}
	<p class="text-error p-6">Search failed.</p>
{:else if allItems.length === 0}
	<SearchResultsEmpty query={q} />
{:else}
	<PhotoColumnGrid
		items={allItems as unknown as PhotoItem[]}
		{columnCount}
		onItemClick={handleClick}
	/>
	<div bind:this={sentinel} class="h-1"></div>
	{#if $query.isFetchingNextPage}
		<div class="flex justify-center py-4">
			<div
				class="border-accent h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
			></div>
		</div>
	{/if}
{/if}

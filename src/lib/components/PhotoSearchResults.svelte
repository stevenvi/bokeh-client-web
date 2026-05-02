<script lang="ts">
	import { createInfiniteQuery, createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { searchPhotos, searchPhotoCollections } from '$lib/api/search';
	import { getPhotoColumnCount } from '$lib/utils/photoColumnCount';
	import CollectionTile from './CollectionTile.svelte';
	import PhotoColumnGrid from './PhotoColumnGrid.svelte';
	import SearchResultsEmpty from './SearchResultsEmpty.svelte';
	import SlideshowView from './SlideshowView.svelte';
	import type { PhotoItem, SearchPhotoCollection } from '$lib/types';

	interface Props {
		q: string;
		loading: boolean;
	}

	let { q, loading = $bindable() }: Props = $props();

	const photosQ = $derived(
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

	const collectionsQ = $derived(
		createQuery({
			queryKey: ['search', 'photos', 'collections', q],
			queryFn: () => searchPhotoCollections(q, 0, 50)
		})
	);

	const allItems = $derived(($photosQ.data?.pages ?? []).flatMap((p) => p.items));
	const collections = $derived($collectionsQ.data?.collections ?? []);

	const allEmpty = $derived(allItems.length === 0 && collections.length === 0);
	const allSettled = $derived(!$photosQ.isPending && !$collectionsQ.isPending);
	const anyError = $derived($photosQ.isError || $collectionsQ.isError);

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
				if (entry.isIntersecting && $photosQ.hasNextPage && !$photosQ.isFetchingNextPage) {
					$photosQ.fetchNextPage();
				}
			},
			{ rootMargin: '300px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	$effect(() => {
		loading = $photosQ.isFetching || $collectionsQ.isFetching;
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

	function onCollectionClick(c: SearchPhotoCollection) {
		goto('/photo/' + c.collection_path.join('/'));
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

{#if anyError && allEmpty}
	<p class="text-error p-6">Search failed.</p>
{:else if allSettled && allEmpty}
	<SearchResultsEmpty query={q} />
{:else}
	{#if collections.length > 0}
		<section class="mb-6">
			<h2 class="text-text-secondary mt-2 mb-3 text-xs font-semibold tracking-wide uppercase">
				Albums
			</h2>
			<div
				class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
			>
				{#each collections as collection (collection.id)}
					<CollectionTile
						id={collection.id}
						name={collection.name}
						type="image:photo"
						date={collection.date}
						onclick={() => onCollectionClick(collection)}
					/>
				{/each}
			</div>
		</section>
	{/if}
	{#if allItems.length > 0}
		<section class="mb-6">
			<h2 class="text-text-secondary mt-2 mb-3 text-xs font-semibold tracking-wide uppercase">
				Photos
			</h2>
			<PhotoColumnGrid
				items={allItems as unknown as PhotoItem[]}
				{columnCount}
				onItemClick={handleClick}
			/>
			<div bind:this={sentinel} class="h-1"></div>
			{#if $photosQ.isFetchingNextPage}
				<div class="flex justify-center py-4">
					<div
						class="border-accent h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
					></div>
				</div>
			{/if}
		</section>
	{/if}
{/if}

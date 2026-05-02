<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { searchVideos } from '$lib/api/search';
	import { videoCoverUrl } from '$lib/api/video';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import { leafCollectionId } from '$lib/utils/collectionPath';
	import VideoTile from './VideoTile.svelte';
	import SearchResultsEmpty from './SearchResultsEmpty.svelte';
	import type { SearchVideoItem } from '$lib/types';

	interface Props {
		q: string;
		loading: boolean;
	}

	let { q, loading = $bindable() }: Props = $props();

	const query = $derived(
		createQuery({
			queryKey: ['search', 'videos', q],
			queryFn: () => searchVideos(q, 0, 50)
		})
	);

	const movies = $derived($query.data?.['video:movie'] ?? []);
	const homeMovies = $derived($query.data?.['video:home_movie'] ?? []);

	$effect(() => {
		loading = $query.isFetching;
	});

	function onVideoClick(item: SearchVideoItem) {
		const path = '/video/' + item.collection_path.join('/');
		const wp = path + '/watch/' + item.id;
		mediaPlayer.playVideo({
			itemId: item.id,
			title: item.title,
			collectionId: leafCollectionId(item.collection_path),
			collectionName: item.collection_name,
			collectionType: '',
			bookmarkSeconds: null,
			thumbnailUrl: videoCoverUrl(item.id),
			collectionPath: path,
			watchPath: wp
		});
		goto(wp);
	}
</script>

{#if $query.isPending}
	<div class="flex h-48 items-center justify-center">
		<div
			class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
		></div>
	</div>
{:else if $query.isError}
	<p class="text-error p-6">Search failed.</p>
{:else if movies.length === 0 && homeMovies.length === 0}
	<SearchResultsEmpty query={q} />
{:else}
	{#if movies.length > 0}
		<section class="mb-6">
			<h2
				class="text-text-secondary mt-2 mb-3 text-xs font-semibold tracking-wide uppercase"
			>
				Movies
			</h2>
			<div
				class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
			>
				{#each movies as item (item.id)}
					<VideoTile
						id={item.id}
						title={item.title}
						date={item.date}
						aspectRatio="2/3"
						onclick={() => onVideoClick(item)}
					/>
				{/each}
			</div>
		</section>
	{/if}
	{#if homeMovies.length > 0}
		<section class="mb-6">
			<h2
				class="text-text-secondary mt-2 mb-3 text-xs font-semibold tracking-wide uppercase"
			>
				Home movies
			</h2>
			<div
				class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
			>
				{#each homeMovies as item (item.id)}
					<VideoTile
						id={item.id}
						title={item.title}
						date={item.date}
						aspectRatio="4/3"
						onclick={() => onVideoClick(item)}
					/>
				{/each}
			</div>
		</section>
	{/if}
{/if}

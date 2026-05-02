<script lang="ts">
	import { createQuery, createInfiniteQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { listArtists } from '$lib/api/music';
	import ArtistTile from './ArtistTile.svelte';
	import AdminTileMenu from './AdminTileMenu.svelte';
	import ScrollRestore from './ScrollRestore.svelte';
	import { authStore } from '$lib/stores/auth';
	import { adminUploadArtistImage, adminDeleteArtistImage } from '$lib/api/admin';
	import { artistImageBust, bumpArtistImageBust } from '$lib/stores/coverBust';
	import { toastStore } from '$lib/stores/toast';

	interface Props {
		collectionId: number;
	}

	let { collectionId }: Props = $props();

	const artistsQuery = $derived(
		createInfiniteQuery({
			queryKey: ['music', 'artists', collectionId],
			queryFn: ({ pageParam }) => listArtists(collectionId, pageParam, 60),
			initialPageParam: 1,
			getNextPageParam: (lastPage) => {
				const loaded = lastPage.page * lastPage.page_size;
				return loaded < lastPage.total_count ? lastPage.page + 1 : undefined;
			}
		})
	);

	const allArtists = $derived(
		$artistsQuery.data?.pages.flatMap((p) => p.artists) ?? []
	);

	// Infinite scroll observer
	let sentinel: HTMLDivElement | undefined = $state();
	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && $artistsQuery.hasNextPage && !$artistsQuery.isFetchingNextPage) {
					$artistsQuery.fetchNextPage();
				}
			},
			{ rootMargin: '300px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	function openArtist(artistId: number) {
		goto(`/audio/${collectionId}/artist/${artistId}`);
	}
</script>

<ScrollRestore path={`/audio/${collectionId}`} />

<div class="">
	<div class="px-4 py-4">
		{#if $artistsQuery.isPending}
			<div class="flex h-48 items-center justify-center">
				<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
			</div>
		{:else if $artistsQuery.isError}
			<p class="text-error p-6">Failed to load artists.</p>
		{:else if allArtists.length === 0}
			<p class="text-text-secondary p-6 text-center">No artists found.</p>
		{:else}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{#each allArtists as artist (artist.id)}
					<div class="relative">
						<ArtistTile
							id={artist.id}
							name={artist.name}
							bust={$artistImageBust[artist.id]}
							onclick={() => openArtist(artist.id)}
						/>
						{#if $authStore?.isAdmin}
							<div class="absolute top-1 right-1 z-10" onclick={(e) => e.stopPropagation()}>
								<AdminTileMenu items={[
									{ emoji: '🖼', label: 'Upload Image', fileAccept: 'image/*', onFile: async (f) => { await adminUploadArtistImage(artist.id, f); bumpArtistImageBust(artist.id); toastStore.show('Artist image updated.'); } },
									{ emoji: '🗑', label: 'Remove Image', action: async () => { await adminDeleteArtistImage(artist.id); bumpArtistImageBust(artist.id); toastStore.show('Artist image removed.'); } }
								]} />
							</div>
						{/if}
					</div>
				{/each}
			</div>
			<div bind:this={sentinel} class="h-4"></div>
		{/if}
	</div>
</div>

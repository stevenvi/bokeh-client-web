<script lang="ts">
	import { createQuery, createInfiniteQuery } from '@tanstack/svelte-query';
	import { goto, afterNavigate } from '$app/navigation';
	import { listArtists } from '$lib/api/music';
	import { navigationStore } from '$lib/stores/navigation';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import ArtistTile from './ArtistTile.svelte';
	import AdminTileMenu from './AdminTileMenu.svelte';
	import { authStore } from '$lib/stores/auth';
	import { adminUploadArtistImage, adminDeleteArtistImage } from '$lib/api/admin';
	import { artistImageBust, bumpArtistImageBust } from '$lib/stores/coverBust';
	import { toastStore } from '$lib/stores/toast';

	interface Props {
		collectionId: number;
		collectionName: string;
		parentCollectionId: number | null;
	}

	let { collectionId, collectionName, parentCollectionId }: Props = $props();
	let searchTerm = $state('');
	let debouncedSearch = $state('');
	let debounceTimer: ReturnType<typeof setTimeout>;

	function onSearchInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		searchTerm = value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debouncedSearch = value;
		}, 300);
	}

	const artistsQuery = $derived(
		createInfiniteQuery({
			queryKey: ['music', 'artists', collectionId, debouncedSearch],
			queryFn: ({ pageParam }) =>
				listArtists(collectionId, pageParam, 60, debouncedSearch),
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

	afterNavigate(() => {
		const saved = navigationStore.getScrollPosition(collectionId);
		if (saved > 0) {
			window.scrollTo({ top: saved, behavior: 'instant' });
		}
	});

	function openArtist(artistId: number, artistName: string) {
		navigationStore.saveScrollPosition(collectionId, window.scrollY);
		navigationStore.push({ id: artistId, name: artistName, path: `/collection/${collectionId}/artist/${artistId}` });
		goto(`/collection/${collectionId}/artist/${artistId}`);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (parentCollectionId != null) {
				goto(`/collection/${parentCollectionId}`);
			} else {
				goto('/');
			}
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="min-h-dvh" class:pb-24={$mediaPlayer.visible}>
	<!-- Search bar -->
	<div class="px-4 pt-4">
		<input
			type="text"
			placeholder="Search artists..."
			value={searchTerm}
			oninput={onSearchInput}
			class="bg-surface-raised text-text-primary placeholder-text-muted w-full rounded-lg border border-border px-4 py-2 text-sm focus:border-accent focus:outline-none"
		/>
	</div>

	<!-- Artist grid -->
	<div class="px-4 py-4">
		{#if $artistsQuery.isPending}
			<div class="flex h-48 items-center justify-center">
				<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
			</div>
		{:else if $artistsQuery.isError}
			<p class="text-error p-6">Failed to load artists.</p>
		{:else if allArtists.length === 0}
			<p class="text-text-muted p-6 text-center">No artists found.</p>
		{:else}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{#each allArtists as artist (artist.id)}
					<div class="relative">
						<ArtistTile
							id={artist.id}
							name={artist.name}
							bust={$artistImageBust[artist.id]}
							onclick={() => openArtist(artist.id, artist.name)}
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

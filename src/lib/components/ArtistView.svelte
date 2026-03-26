<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { listArtistAlbums } from '$lib/api/music';
	import { artistImageUrl } from '$lib/api/music';
	import { navigationStore } from '$lib/stores/navigation';
	import { musicPlayerStore } from '$lib/stores/musicPlayer';
	import AlbumTile from './AlbumTile.svelte';

	interface Props {
		artistId: number;
		rootCollectionId: number;
	}

	let { artistId, rootCollectionId }: Props = $props();

	const albumsQuery = $derived(
		createQuery({
			queryKey: ['music', 'collection', rootCollectionId, 'artist', artistId, 'albums'],
			queryFn: () => listArtistAlbums(rootCollectionId, artistId)
		})
	);

	let artistImageLoaded = $state(false);
	let artistImageError = $state(false);

	$effect(() => {
		if ($albumsQuery.data) {
			navigationStore.push({
				id: artistId,
				name: $albumsQuery.data.artist.name,
				path: `/collection/${rootCollectionId}/artist/${artistId}`
			});
		}
	});

	function openAlbum(albumId: number, albumName: string) {
		navigationStore.push({ id: albumId, name: albumName, path: `/music/album/${albumId}?collection=${rootCollectionId}` });
		goto(`/music/album/${albumId}?collection=${rootCollectionId}`);
	}

	function playAlbum(albumId: number) {
		musicPlayerStore.playAlbum(rootCollectionId, albumId);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			goto(`/collection/${rootCollectionId}`);
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="min-h-dvh" class:pb-24={$musicPlayerStore.visible}>
	{#if $albumsQuery.isPending}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if $albumsQuery.isError}
		<p class="text-error p-6">Failed to load artist.</p>
	{:else if $albumsQuery.data}
		{@const artist = $albumsQuery.data.artist}
		{@const albums = $albumsQuery.data.albums}

		<!-- Artist header -->
		<div class="flex items-center gap-4 px-4 py-6">
			<div class="bg-surface-raised relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full">
				{#if !artistImageError}
					<img
						src={artistImageUrl(artist.id)}
						alt=""
						class="h-full w-full object-cover transition-opacity duration-300"
						class:opacity-0={!artistImageLoaded}
						onload={() => (artistImageLoaded = true)}
						onerror={() => (artistImageError = true)}
					/>
				{/if}
				{#if !artistImageLoaded || artistImageError}
					<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-raised to-border">
						<svg class="text-text-muted h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
						</svg>
					</div>
				{/if}
			</div>
			<div>
				<h1 class="text-text-primary text-2xl font-bold">{artist.name}</h1>
				<p class="text-text-muted text-sm">
					{albums.length} {albums.length === 1 ? 'album' : 'albums'}
				</p>
			</div>
		</div>

		<!-- Album grid -->
		<div class="px-4 pb-4">
			{#if albums.length === 0}
				<p class="text-text-muted text-center">No albums found.</p>
			{:else}
				<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
					{#each albums as album (album.album_id)}
						<AlbumTile
							albumId={album.album_id}
							name={album.name}
							year={album.year}
							onClickTitle={() => openAlbum(album.album_id, album.name)}
							onClickImage={() => playAlbum(album.album_id)}
						/>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

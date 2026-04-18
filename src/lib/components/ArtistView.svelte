<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { listArtistAlbums } from '$lib/api/music';
	import { artistImageUrl } from '$lib/api/music';
	import { navigationStore } from '$lib/stores/navigation';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import AlbumTile from './AlbumTile.svelte';
	import AdminTileMenu from './AdminTileMenu.svelte';
	import { authStore } from '$lib/stores/auth';
	import { adminUploadArtistImage, adminDeleteArtistImage, adminUploadAlbumCover, adminDeleteAlbumCover } from '$lib/api/admin';
	import { artistImageBust, bumpArtistImageBust, albumCoverBust, bumpAlbumCoverBust } from '$lib/stores/coverBust';
	import { toastStore } from '$lib/stores/toast';

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
		mediaPlayer.playAlbum(rootCollectionId, albumId);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			goto(`/collection/${rootCollectionId}`);
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="min-h-dvh" class:pb-24={$mediaPlayer.visible}>
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
			<div class="relative h-24 w-24 flex-shrink-0">
				<div class="bg-surface-raised h-full w-full overflow-hidden rounded-full">
					{#if !artistImageError}
						<img
							src={artistImageUrl(artist.id) + ($artistImageBust[artist.id] ? `?v=${$artistImageBust[artist.id]}` : '')}
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
				{#if $authStore?.isAdmin}
					<div class="absolute top-0 right-0 z-10">
						<AdminTileMenu items={[
							{ emoji: '🖼', label: 'Upload Image', fileAccept: 'image/*', onFile: async (f) => { await adminUploadArtistImage(artist.id, f); artistImageError = false; artistImageLoaded = false; bumpArtistImageBust(artist.id); toastStore.show('Artist image updated.'); } },
							{ emoji: '🗑', label: 'Remove Image', action: async () => { await adminDeleteArtistImage(artist.id); artistImageError = true; artistImageLoaded = false; bumpArtistImageBust(artist.id); toastStore.show('Artist image removed.'); } }
						]} />
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
						<div class="relative">
							<AlbumTile
								albumId={album.album_id}
								name={album.name}
								year={album.year}
								bust={$albumCoverBust[album.album_id]}
								onClickTitle={() => openAlbum(album.album_id, album.name)}
								onClickImage={() => playAlbum(album.album_id)}
							/>
							{#if $authStore?.isAdmin}
								<div class="absolute top-1 right-1 z-10" onclick={(e) => e.stopPropagation()}>
									<AdminTileMenu items={[
										{ emoji: '🖼', label: 'Upload Cover', fileAccept: 'image/*', onFile: async (f) => { await adminUploadAlbumCover(album.album_id, f); bumpAlbumCoverBust(album.album_id); toastStore.show('Album cover updated.'); } },
										{ emoji: '🗑', label: 'Remove Cover', action: async () => { await adminDeleteAlbumCover(album.album_id); bumpAlbumCoverBust(album.album_id); toastStore.show('Album cover removed.'); } }
									]} />
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

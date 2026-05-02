<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import {
		searchAudioTracks,
		searchAudioAlbums,
		searchAudioArtists
	} from '$lib/api/search';
	import { albumCoverUrl, listAlbumTracks } from '$lib/api/music';
	import { listShowEpisodes } from '$lib/api/radio';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import AlbumTile from './AlbumTile.svelte';
	import ArtistTile from './ArtistTile.svelte';
	import ShowTile from './ShowTile.svelte';
	import SearchResultsEmpty from './SearchResultsEmpty.svelte';
	import { IconMusic } from './icons';
	import type {
		SearchAudioTrack,
		SearchAudioAlbum,
		SearchAudioArtist
	} from '$lib/types';

	interface Props {
		q: string;
		loading: boolean;
	}

	let { q, loading = $bindable() }: Props = $props();

	const tracksQ = $derived(
		createQuery({
			queryKey: ['search', 'audio', 'tracks', q],
			queryFn: () => searchAudioTracks(q, 0, 15)
		})
	);
	const albumsQ = $derived(
		createQuery({
			queryKey: ['search', 'audio', 'albums', q],
			queryFn: () => searchAudioAlbums(q, 0, 10)
		})
	);
	const artistsQ = $derived(
		createQuery({
			queryKey: ['search', 'audio', 'artists', q],
			queryFn: () => searchAudioArtists(q, 0, 10)
		})
	);

	const tracks = $derived($tracksQ.data?.tracks ?? []);
	const albums = $derived($albumsQ.data?.albums ?? []);
	const artists = $derived($artistsQ.data?.artists ?? []);
	const shows = $derived($artistsQ.data?.shows ?? []);

	const allEmpty = $derived(
		tracks.length === 0 &&
			albums.length === 0 &&
			artists.length === 0 &&
			shows.length === 0
	);
	const allSettled = $derived(
		!$tracksQ.isPending && !$albumsQ.isPending && !$artistsQ.isPending
	);
	const anyError = $derived($tracksQ.isError || $albumsQ.isError || $artistsQ.isError);

	$effect(() => {
		loading = $tracksQ.isFetching || $albumsQ.isFetching || $artistsQ.isFetching;
	});

	async function onTrackClick(track: SearchAudioTrack) {
		const cid = track.collection_id;
		if (track.collection_type === 'audio:show') {
			const data = await listShowEpisodes(cid, track.artist_id);
			const idx = data.episodes.findIndex((e) => e.id === track.id);
			if (idx >= 0) {
				const collectionPath = `/audio/${cid}/show/${track.artist_id}`;
				mediaPlayer.playShowFromEpisode(
					track.artist_id,
					data.show.name,
					data.episodes,
					idx,
					0,
					collectionPath
				);
				goto(collectionPath);
			}
		} else {
			if (track.album_id == null) return;
			const data = await listAlbumTracks(cid, track.album_id);
			const idx = data.tracks.findIndex((t) => t.id === track.id);
			if (idx >= 0) {
				const path = `/audio/${cid}/artist/${track.artist_id}/album/${track.album_id}`;
				mediaPlayer.playAlbumFromTrack(track.album_id, data.album.name, data.tracks, idx, path);
				goto(path);
			}
		}
	}

	function onAlbumClick(album: SearchAudioAlbum) {
		goto(`/audio/${album.collection_id}/artist/${album.artist_id}/album/${album.id}`);
	}

	function onArtistClick(artist: SearchAudioArtist) {
		goto(`/audio/${artist.collection_id}/artist/${artist.id}`);
	}

	function onShowClick(show: SearchAudioArtist) {
		goto(`/audio/${show.collection_id}/show/${show.id}`);
	}
</script>

{#if anyError && allEmpty}
	<p class="text-error p-6">Search failed.</p>
{:else if allSettled && allEmpty}
	<SearchResultsEmpty query={q} />
{:else}
	{#if tracks.length > 0}
		<section class="mb-6">
			<h2
				class="text-text-secondary mt-2 mb-3 text-xs font-semibold tracking-wide uppercase"
			>
				Songs
			</h2>
			<div
				class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
			>
				{#each tracks as track (track.id)}
					<button class="group w-full text-left" onclick={() => onTrackClick(track)}>
						<div
							class="bg-surface-raised relative aspect-square w-full overflow-hidden rounded-lg"
						>
							{#if track.album_id != null}
								<img
									src={albumCoverUrl(track.album_id)}
									alt=""
									class="absolute inset-0 h-full w-full object-cover"
									onerror={(e) => {
										(e.currentTarget as HTMLImageElement).style.display = 'none';
									}}
								/>
							{:else}
								<div
									class="from-surface-raised to-border absolute inset-0 flex h-full w-full items-center justify-center bg-gradient-to-br"
								>
									<IconMusic class="text-text-muted h-12 w-12" />
								</div>
							{/if}
						</div>
						<p class="text-text-primary mt-2 truncate text-sm font-medium">{track.title}</p>
						{#if track.artist_name}
							<p class="text-text-secondary truncate text-xs">{track.artist_name}</p>
						{/if}
					</button>
				{/each}
			</div>
		</section>
	{/if}
	{#if albums.length > 0}
		<section class="mb-6">
			<h2
				class="text-text-secondary mt-2 mb-3 text-xs font-semibold tracking-wide uppercase"
			>
				Albums
			</h2>
			<div
				class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
			>
				{#each albums as album (album.id)}
					<AlbumTile
						albumId={album.id}
						name={album.name}
						year={album.year}
						onClickTitle={() => onAlbumClick(album)}
						onClickImage={() => onAlbumClick(album)}
					/>
				{/each}
			</div>
		</section>
	{/if}
	{#if artists.length > 0 || shows.length > 0}
		<section class="mb-6">
			<h2
				class="text-text-secondary mt-2 mb-3 text-xs font-semibold tracking-wide uppercase"
			>
				Artists
			</h2>
			<div
				class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
			>
				{#each artists as artist (`artist-${artist.id}`)}
					<ArtistTile id={artist.id} name={artist.name} onclick={() => onArtistClick(artist)} />
				{/each}
				{#each shows as show (`show-${show.id}`)}
					<ShowTile
						showId={show.id}
						name={show.name}
						onClickTitle={() => onShowClick(show)}
					/>
				{/each}
			</div>
		</section>
	{/if}
{/if}

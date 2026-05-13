<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { listAlbumTracks, albumCoverUrl } from '$lib/api/music';
	import { navigationStore } from '$lib/stores/navigation';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import { playingTrackIdFromState } from '$lib/utils/playingTrack.svelte';
	import type { TrackView } from '$lib/types';
	import ScrollRestore from './ScrollRestore.svelte';
	import { IconMusic, IconPlay } from './icons';

	interface Props {
		albumId: number;
		rootCollectionId: number;
		artistId: number;
	}

	let { albumId, rootCollectionId, artistId }: Props = $props();

	const tracksQuery = $derived(
		createQuery({
			queryKey: ['music', 'album', albumId, 'tracks'],
			queryFn: () => listAlbumTracks(rootCollectionId, albumId)
		})
	);

	let coverLoaded = $state(false);
	let coverError = $state(false);

	$effect(() => {
		if ($tracksQuery.data) {
			navigationStore.push({
				id: albumId,
				name: $tracksQuery.data.album.name,
				path: `/audio/${rootCollectionId}/artist/${artistId}/album/${albumId}`
			});
		}
	});

	function formatDuration(seconds: number | null): string {
		if (seconds == null) return '--:--';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function formatTotalDuration(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		if (h > 0) return `${h} hr ${m} min`;
		return `${m} min`;
	}

	// Group tracks by disc
	const discGroups = $derived.by(() => {
		const data = $tracksQuery.data;
		if (!data) return [];
		const groups = new Map<number, TrackView[]>();
		for (const track of data.tracks) {
			const disc = track.disc_number ?? 1;
			if (!groups.has(disc)) groups.set(disc, []);
			groups.get(disc)!.push(track);
		}
		return Array.from(groups.entries()).sort(([a], [b]) => a - b);
	});

	const discCount = $derived($tracksQuery.data?.disc_count ?? 1);
	const albumName = $derived($tracksQuery.data?.album.name ?? '');

	function playTrack(trackIndex: number) {
		const data = $tracksQuery.data;
		if (!data) return;
		mediaPlayer.playAlbumFromTrack(albumId, albumName, data.tracks, trackIndex, `/audio/${rootCollectionId}/artist/${artistId}/album/${albumId}`);
	}

	const playingTrackId = $derived(playingTrackIdFromState($mediaPlayer, albumId));

	let scrolledToPlaying = $state<number | null>(null);
	$effect(() => {
		if (playingTrackId == null) return;
		if (scrolledToPlaying === playingTrackId) return;
		if (!$tracksQuery.data) return;
		scrolledToPlaying = playingTrackId;
		setTimeout(() => {
			document.getElementById(`track-${playingTrackId}`)?.scrollIntoView({
				behavior: 'smooth',
				block: 'center'
			});
		}, 50);
	});
</script>

<ScrollRestore path={`/audio/${rootCollectionId}/artist/${artistId}/album/${albumId}`} />

<div class="">
	{#if $tracksQuery.isPending}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if $tracksQuery.isError}
		<p class="text-error p-6">Failed to load tracks.</p>
	{:else if $tracksQuery.data}
		{@const data = $tracksQuery.data}

		<div class="flex flex-col gap-6 p-4 lg:flex-row">
			<!-- Album art -->
			<div class="flex-shrink-0 lg:w-80">
				<div class="bg-surface-raised relative aspect-square w-full overflow-hidden rounded-lg">
					{#if !coverError}
						<img
							src={albumCoverUrl(albumId)}
							alt=""
							class="h-full w-full object-cover transition-opacity duration-300"
							class:opacity-0={!coverLoaded}
							onload={() => (coverLoaded = true)}
							onerror={() => (coverError = true)}
						/>
					{/if}
					{#if !coverLoaded || coverError}
						<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-raised to-border">
							<IconMusic class="text-text-muted h-16 w-16" />
						</div>
					{/if}
				</div>
				<h1 class="text-text-primary mt-3 text-center text-xl font-bold">{albumName}</h1>
				<p class="text-text-secondary text-center text-sm">
					{data.tracks.length} {data.tracks.length === 1 ? 'track' : 'tracks'} &middot; {formatTotalDuration(data.total_duration)}
				</p>
			</div>

			<!-- Track listing -->
			<div class="min-w-0 flex-1">
				{#each discGroups as [discNum, tracks], groupIdx}
					{#if discCount > 1}
						<h2 class="text-text-secondary mb-2 text-xs font-semibold uppercase tracking-wide" class:mt-6={groupIdx > 0}>
							Disc {discNum}
						</h2>
					{/if}
					<div class="divide-y divide-border">
						{#each tracks as track, i}
							{@const globalIndex = data.tracks.indexOf(track)}
							{@const isPlaying = track.id === playingTrackId}
							<button
								id="track-{track.id}"
								class="group flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors {isPlaying ? 'bg-yellow-400 hover:bg-surface-raised' : 'hover:bg-surface-raised ' + (globalIndex % 2 === 0 ? 'bg-teal-900/40' : '')}"
								onclick={() => playTrack(globalIndex)}
							>
								<span class="w-6 flex-shrink-0 text-right text-sm tabular-nums {isPlaying ? 'text-yellow-900 font-bold' : 'text-black group-hover:text-gray-200'}">
									{track.track_number ?? i + 1}
								</span>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm {isPlaying ? 'text-yellow-900 font-semibold' : 'text-white text-shadow-dark'}">{track.title}</p>
									{#if track.artist_name}
										<p class="truncate text-xs {isPlaying ? 'text-yellow-800' : 'text-white/65 group-hover:text-white/90'}">{track.artist_name}</p>
									{/if}
								</div>
								{#if isPlaying}
									<IconPlay class="text-yellow-900 h-3.5 w-3.5 flex-shrink-0" />
								{/if}
								<span class="flex-shrink-0 text-sm tabular-nums {isPlaying ? 'text-yellow-900' : 'text-text-primary text-shadow-dark'}">
									{formatDuration(track.duration_seconds)}
								</span>
							</button>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

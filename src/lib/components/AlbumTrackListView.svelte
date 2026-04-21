<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { listAlbumTracks, albumCoverUrl } from '$lib/api/music';
	import { navigationStore } from '$lib/stores/navigation';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import type { TrackView } from '$lib/types';

	interface Props {
		albumId: number;
		rootCollectionId: number;
	}

	let { albumId, rootCollectionId }: Props = $props();

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
				path: `/music/album/${albumId}?collection=${rootCollectionId}`
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
		mediaPlayer.playAlbumFromTrack(albumId, albumName, data.tracks, trackIndex);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			history.back();
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

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
							<svg class="text-text-muted h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
							</svg>
						</div>
					{/if}
				</div>
				<h1 class="text-text-primary mt-3 text-center text-xl font-bold">{albumName}</h1>
				<p class="text-text-muted text-center text-sm">
					{data.tracks.length} {data.tracks.length === 1 ? 'track' : 'tracks'} &middot; {formatTotalDuration(data.total_duration)}
				</p>
			</div>

			<!-- Track listing -->
			<div class="min-w-0 flex-1">
				{#each discGroups as [discNum, tracks], groupIdx}
					{#if discCount > 1}
						<h2 class="text-text-muted mb-2 text-xs font-semibold uppercase tracking-wide" class:mt-6={groupIdx > 0}>
							Disc {discNum}
						</h2>
					{/if}
					<div class="divide-y divide-border">
						{#each tracks as track, i}
							{@const globalIndex = data.tracks.indexOf(track)}
							<button
								class="group flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-surface-raised {globalIndex % 2 === 0 ? 'bg-teal-900/40' : ''}"
								onclick={() => playTrack(globalIndex)}
							>
								<span class="w-6 flex-shrink-0 text-right text-sm tabular-nums text-black group-hover:text-gray-200">
									{track.track_number ?? i + 1}
								</span>
								<div class="min-w-0 flex-1">
									<p class="text-white text-shadow-dark truncate text-sm">{track.title}</p>
									{#if track.artist_name}
										<p class="truncate text-xs text-white/65 group-hover:text-white/90">{track.artist_name}</p>
									{/if}
								</div>
								<span class="flex-shrink-0 text-sm tabular-nums text-black group-hover:text-gray-200">
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

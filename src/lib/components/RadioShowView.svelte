<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { listShowEpisodes, upsertShowBookmark } from '$lib/api/radio';
	import { artistImageUrl } from '$lib/api/music';
	import { navigationStore } from '$lib/stores/navigation';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import { playingTrackIdFromState } from '$lib/utils/playingTrack.svelte';
	import AdminTileMenu from './AdminTileMenu.svelte';
	import ConfirmPopup from './ConfirmPopup.svelte';
	import ScrollRestore from './ScrollRestore.svelte';
	import { IconRadio, IconPlay } from './icons';
	import { authStore } from '$lib/stores/auth';
	import { adminUploadArtistImage, adminDeleteArtistImage } from '$lib/api/admin';
	import { artistImageBust, bumpArtistImageBust } from '$lib/stores/coverBust';
	import { toastStore } from '$lib/stores/toast';
	import type { EpisodeView, ShowBookmark } from '$lib/types';

	interface Props {
		showId: number;
		collectionId: number;
	}

	let { showId, collectionId }: Props = $props();

	const episodesQuery = $derived(
		createQuery({
			queryKey: ['radio', 'show', showId, 'episodes'],
			queryFn: () => listShowEpisodes(collectionId, showId)
		})
	);

	let imageLoaded = $state(false);
	let imageError = $state(false);

	$effect(() => {
		if ($episodesQuery.data) {
			navigationStore.push({
				id: showId,
				name: $episodesQuery.data.show.name,
				path: `/audio/${collectionId}/show/${showId}`
			});
		}
	});

	// ── Two-level grouping: album (grouping name) → disc ────────────────────

	interface DiscGroup {
		discLabel: string | null; // "Disc N" or null if only one disc in album
		episodes: EpisodeView[];
	}
	interface AlbumGroup {
		albumName: string;
		discs: DiscGroup[];
	}

	const episodeGroups = $derived.by((): AlbumGroup[] => {
		const data = $episodesQuery.data;
		if (!data) return [];

		// Group by album name first (order preserved from server's natural sort)
		const albumMap = new Map<string, EpisodeView[]>();
		for (const ep of data.episodes) {
			if (!albumMap.has(ep.album_name)) albumMap.set(ep.album_name, []);
			albumMap.get(ep.album_name)!.push(ep);
		}

		return Array.from(albumMap.entries()).map(([albumName, episodes]) => {
			// Within each album, check if disc numbers create sub-groups
			const discNums = new Set(episodes.map((e) => e.disc_number ?? 1));
			const hasDiscs = discNums.size > 1;

			const discMap = new Map<number, EpisodeView[]>();
			for (const ep of episodes) {
				const d = ep.disc_number ?? 1;
				if (!discMap.has(d)) discMap.set(d, []);
				discMap.get(d)!.push(ep);
			}

			const discs: DiscGroup[] = Array.from(discMap.entries())
				.sort(([a], [b]) => a - b)
				.map(([disc, eps]) => ({
					discLabel: hasDiscs ? `Disc ${disc}` : null,
					episodes: eps
				}));

			return { albumName, discs };
		});
	});

	// ── Bookmark / resume logic ──────────────────────────────────────────────

	const resumeTarget = $derived.by(() => {
		const data = $episodesQuery.data;
		if (!data) return null;
		const { episodes, bookmark } = data;
		if (!bookmark) {
			return { episode: episodes[0] ?? null, positionSeconds: 0, globalIndex: 0 };
		}
		const idx = episodes.findIndex((e) => e.id === bookmark.media_item_id);
		if (idx === -1) {
			return { episode: episodes[0] ?? null, positionSeconds: 0, globalIndex: 0 };
		}
		const ep = episodes[idx];
		const nearEnd =
			ep.duration_seconds != null && bookmark.position_seconds >= ep.duration_seconds - 30;
		if (nearEnd) {
			const nextIdx = idx + 1;
			const next = episodes[nextIdx] ?? null;
			return { episode: next ?? ep, positionSeconds: 0, globalIndex: next ? nextIdx : idx };
		}
		return { episode: ep, positionSeconds: bookmark.position_seconds, globalIndex: idx };
	});

	const playingEpisodeId = $derived(playingTrackIdFromState($mediaPlayer, showId));
	const highlightedEpisodeId = $derived(playingEpisodeId ?? resumeTarget?.episode?.id ?? null);

	// Progress bar for the highlighted episode
	const bookmarkProgressPct = $derived.by(() => {
		const target = resumeTarget;
		if (!target || target.positionSeconds <= 0) return 0;
		const ep = target.episode;
		if (!ep || !ep.duration_seconds) return 0;
		return Math.min(100, (target.positionSeconds / ep.duration_seconds) * 100);
	});

	// Scroll highlighted episode into view after load — only on a fresh entry
	// to the page. If we have a saved scroll position from the breadcrumb
	// stack, ScrollRestore handles placement and we should not override it.
	const showPath = $derived(`/audio/${collectionId}/show/${showId}`);
	let scrolledToEpisode = $state<number | null>(null);
	$effect(() => {
		if (!$episodesQuery.data || highlightedEpisodeId == null) return;
		if (scrolledToEpisode === highlightedEpisodeId) return;
		const isFirst = scrolledToEpisode == null;
		scrolledToEpisode = highlightedEpisodeId;
		if (isFirst && playingEpisodeId == null && navigationStore.getScrollForPath(showPath) > 0) return;
		setTimeout(() => {
			document.getElementById(`episode-${highlightedEpisodeId}`)?.scrollIntoView({
				behavior: 'smooth',
				block: 'center'
			});
		}, 50);
	});

	// ── Playback ─────────────────────────────────────────────────────────────

	function resume() {
		const data = $episodesQuery.data;
		const target = resumeTarget;
		if (!data || !target || !target.episode) return;
		mediaPlayer.playShowFromEpisode(
			showId,
			data.show.name,
			data.episodes,
			target.globalIndex,
			target.positionSeconds,
			`/audio/${collectionId}/show/${showId}`
		);
		upsertShowBookmark(showId, target.episode.id, target.positionSeconds).catch(() => {});
	}

	function playEpisode(globalIndex: number) {
		const data = $episodesQuery.data;
		if (!data) return;
		const ep = data.episodes[globalIndex];
		if (!ep) return;
		const target = resumeTarget;
		const position = target && ep.id === target.episode?.id ? target.positionSeconds : 0;
		mediaPlayer.playShowFromEpisode(showId, data.show.name, data.episodes, globalIndex, position, `/audio/${collectionId}/show/${showId}`);
		upsertShowBookmark(showId, ep.id, position).catch(() => {});
	}

	// ── Formatting ───────────────────────────────────────────────────────────

	function formatDuration(seconds: number | null | undefined): string {
		if (seconds == null) return '--:--';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = Math.floor(seconds % 60);
		if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function formatTotalDuration(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		if (h > 0) return `${h} hr ${m} min`;
		return `${m} min`;
	}

	const totalDuration = $derived.by(() => {
		return ($episodesQuery.data?.episodes ?? []).reduce(
			(sum, e) => sum + (e.duration_seconds ?? 0),
			0
		);
	});

	const resumeLabel = $derived(
		!$episodesQuery.data?.bookmark ? 'Play from Beginning' : 'Resume'
	);

	let confirmRemoveImage = $state(false);

	async function handleRemoveImage() {
		try {
			await adminDeleteArtistImage(showId);
			imageError = true;
			imageLoaded = false;
			bumpArtistImageBust(showId);
			toastStore.show('Show image removed.');
		} catch (e: unknown) {
			toastStore.show(e instanceof Error ? e.message : 'Failed to remove image.');
		} finally {
			confirmRemoveImage = false;
		}
	}
</script>

<ScrollRestore path={showPath} />

<div class="">
	{#if $episodesQuery.isPending}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if $episodesQuery.isError}
		<p class="text-error p-6">Failed to load episodes.</p>
	{:else if $episodesQuery.data}
		{@const data = $episodesQuery.data}

		<div class="flex flex-col gap-6 p-4 lg:flex-row">
			<!-- Show cover + meta -->
			<div class="flex-shrink-0 lg:w-72">
				<div class="bg-surface-raised relative aspect-square w-full overflow-hidden rounded-lg">
					{#if !imageError}
						<img
							src={artistImageUrl(showId) + ($artistImageBust[showId] ? `?v=${$artistImageBust[showId]}` : '')}
							alt=""
							class="h-full w-full object-cover transition-opacity duration-300"
							class:opacity-0={!imageLoaded}
							onload={() => (imageLoaded = true)}
							onerror={() => (imageError = true)}
						/>
					{/if}
					{#if !imageLoaded || imageError}
						<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-raised to-border">
							<IconRadio class="text-text-muted h-16 w-16" />
						</div>
					{/if}
					{#if $authStore?.isAdmin}
						<div class="absolute top-1 right-1 z-10">
							<AdminTileMenu items={[
								{ emoji: '🖼', label: 'Upload Image', fileAccept: 'image/*', onFile: async (f) => { await adminUploadArtistImage(showId, f); imageError = false; imageLoaded = false; bumpArtistImageBust(showId); toastStore.show('Show image updated.'); } },
								{ emoji: '🗑', label: 'Remove Image', action: () => { confirmRemoveImage = true; } }
							]} />
						</div>
					{/if}
				</div>

				<h1 class="text-text-primary mt-3 text-xl font-bold">{data.show.name}</h1>
				<p class="text-text-secondary text-sm">
					{data.episodes.length}
					{data.episodes.length === 1 ? 'episode' : 'episodes'}
					{#if totalDuration > 0}
						&middot; {formatTotalDuration(totalDuration)}
					{/if}
				</p>

				<button
					class="bg-accent hover:bg-accent/90 mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors"
					onclick={resume}
				>
					<IconPlay class="h-4 w-4" />
					{resumeLabel}
				</button>
			</div>

			<!-- Episode listing: album groups → disc sub-groups → episodes -->
			<div class="min-w-0 flex-1">
				{#each episodeGroups as albumGroup, albumIdx}
					<!-- Album (grouping) header -->
					<h2
						class="text-text-secondary mb-1 text-xs font-semibold uppercase tracking-wide"
						class:mt-10={albumIdx > 0}
					>
						{albumGroup.albumName}
					</h2>

					{#each albumGroup.discs as discGroup, discIdx}
						{#if discGroup.discLabel}
							<h3
								class="text-text-secondary mb-1 pl-2 text-xs tracking-wide"
								class:mt-3={discIdx > 0}
							>
								{discGroup.discLabel}
							</h3>
						{/if}

						<div class="divide-y divide-border">
							{#each discGroup.episodes as episode}
								{@const globalIndex = data.episodes.indexOf(episode)}
								{@const isHighlighted = episode.id === highlightedEpisodeId}
								<button
									id="episode-{episode.id}"
									class="group relative flex w-full flex-col text-left transition-colors {isHighlighted ? 'bg-yellow-400 hover:bg-surface-raised' : 'hover:bg-surface-raised ' + (globalIndex % 2 === 0 ? 'bg-teal-900/40' : '')}"
									onclick={() => playEpisode(globalIndex)}
								>
									<div class="flex w-full items-center gap-3 px-2 py-2.5">
										<span class="w-8 flex-shrink-0 text-right text-sm tabular-nums {isHighlighted ? 'text-yellow-900 font-bold' : 'text-black group-hover:text-gray-200'}">
											{episode.track_number ?? globalIndex + 1}
										</span>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm {isHighlighted ? 'text-yellow-900 font-semibold' : 'text-white text-shadow-dark'}">
												{episode.title}
											</p>
											{#if episode.artist_name}
												<p class="truncate text-xs {isHighlighted ? 'text-yellow-800' : 'text-white/65 group-hover:text-white/90'}">{episode.artist_name}</p>
											{/if}
										</div>
										{#if isHighlighted}
											<IconPlay class="text-yellow-900 h-3.5 w-3.5 flex-shrink-0" />
										{/if}
										<span class="flex-shrink-0 text-sm tabular-nums {isHighlighted ? 'text-yellow-900' : 'text-text-primary text-shadow-dark'}">
											{formatDuration(episode.duration_seconds)}
										</span>
									</div>
									{#if isHighlighted && bookmarkProgressPct > 0}
										<div class="h-1 w-full bg-black/40">
											<div class="h-full bg-red-500" style="width: {bookmarkProgressPct}%"></div>
										</div>
									{/if}
								</button>
							{/each}
						</div>
					{/each}
				{/each}
			</div>
		</div>
	{/if}
</div>

{#if confirmRemoveImage && $episodesQuery.data}
	{@const showName = $episodesQuery.data.show.name}
	<ConfirmPopup
		title="Remove Image — {showName}"
		message="Remove the image for this show?"
		imageUrl={artistImageUrl(showId) + ($artistImageBust[showId] ? `?v=${$artistImageBust[showId]}` : '')}
		imageAlt={showName}
		confirmLabel="Remove"
		destructive={true}
		onConfirm={handleRemoveImage}
		onCancel={() => (confirmRemoveImage = false)}
	/>
{/if}

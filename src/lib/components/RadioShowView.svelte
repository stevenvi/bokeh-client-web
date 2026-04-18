<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { listShowEpisodes, upsertShowBookmark } from '$lib/api/radio';
	import { artistImageUrl } from '$lib/api/music';
	import { navigationStore } from '$lib/stores/navigation';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import AdminTileMenu from './AdminTileMenu.svelte';
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
				path: `/radio/show/${showId}?collection=${collectionId}`
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

	const highlightedEpisodeId = $derived(resumeTarget?.episode?.id ?? null);

	// Progress bar for the highlighted episode
	const bookmarkProgressPct = $derived.by(() => {
		const target = resumeTarget;
		if (!target || target.positionSeconds <= 0) return 0;
		const ep = target.episode;
		if (!ep || !ep.duration_seconds) return 0;
		return Math.min(100, (target.positionSeconds / ep.duration_seconds) * 100);
	});

	// Scroll highlighted episode into view after load
	let scrolled = $state(false);
	$effect(() => {
		if (!$episodesQuery.data || scrolled || highlightedEpisodeId == null) return;
		scrolled = true;
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
			target.positionSeconds
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
		mediaPlayer.playShowFromEpisode(showId, data.show.name, data.episodes, globalIndex, position);
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

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') goto(`/collection/${collectionId}`);
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="min-h-dvh" class:pb-24={$mediaPlayer.visible}>
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
							<svg class="text-text-muted h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
							</svg>
						</div>
					{/if}
					{#if $authStore?.isAdmin}
						<div class="absolute top-1 right-1 z-10">
							<AdminTileMenu items={[
								{ emoji: '🖼', label: 'Upload Image', fileAccept: 'image/*', onFile: async (f) => { await adminUploadArtistImage(showId, f); imageError = false; imageLoaded = false; bumpArtistImageBust(showId); toastStore.show('Show image updated.'); } },
								{ emoji: '🗑', label: 'Remove Image', action: async () => { await adminDeleteArtistImage(showId); imageError = true; imageLoaded = false; bumpArtistImageBust(showId); toastStore.show('Show image removed.'); } }
							]} />
						</div>
					{/if}
				</div>

				<h1 class="text-text-primary mt-3 text-xl font-bold">{data.show.name}</h1>
				<p class="text-text-muted text-sm">
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
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M8 5v14l11-7z" />
					</svg>
					{resumeLabel}
				</button>
			</div>

			<!-- Episode listing: album groups → disc sub-groups → episodes -->
			<div class="min-w-0 flex-1">
				{#each episodeGroups as albumGroup, albumIdx}
					<!-- Album (grouping) header -->
					<h2
						class="text-text-muted mb-1 text-xs font-semibold uppercase tracking-wide"
						class:mt-10={albumIdx > 0}
					>
						{albumGroup.albumName}
					</h2>

					{#each albumGroup.discs as discGroup, discIdx}
						{#if discGroup.discLabel}
							<h3
								class="text-text-muted mb-1 pl-2 text-xs tracking-wide"
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
									class="relative flex w-full flex-col text-left transition-colors {isHighlighted ? 'border-l-4 border-accent bg-accent/40 hover:bg-accent/45' : 'hover:bg-surface-raised ' + (globalIndex % 2 === 0 ? 'bg-[rgb(26_26_26/0.25)]' : '')}"
									onclick={() => playEpisode(globalIndex)}
								>
									<div class="flex w-full items-center gap-3 px-2 py-2.5">
										<span class="w-8 flex-shrink-0 text-right text-sm tabular-nums {isHighlighted ? 'text-accent font-bold' : 'text-text-muted'}">
											{episode.track_number ?? globalIndex + 1}
										</span>
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm {isHighlighted ? 'text-accent font-semibold' : 'text-text-primary'}">
												{episode.title}
											</p>
											{#if episode.artist_name}
												<p class="text-text-muted truncate text-xs">{episode.artist_name}</p>
											{/if}
										</div>
										{#if isHighlighted}
											<svg class="text-accent h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
												<path d="M8 5v14l11-7z" />
											</svg>
										{/if}
										<span class="flex-shrink-0 text-sm tabular-nums {isHighlighted ? 'text-accent' : 'text-text-muted'}">
											{formatDuration(episode.duration_seconds)}
										</span>
									</div>
									{#if isHighlighted && bookmarkProgressPct > 0}
										<div class="h-1 w-full bg-accent/20">
											<div class="h-full bg-accent" style="width: {bookmarkProgressPct}%"></div>
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

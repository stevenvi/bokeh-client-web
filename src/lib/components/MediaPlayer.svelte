<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import { setBookmark, clearBookmark } from '$lib/api/video';
	import type { MediaItemDetail } from '$lib/types';
	import type { ItemsPage } from '$lib/api/collections';

	const queryClient = useQueryClient();

	let audioEl: HTMLAudioElement;
	let videoEl: HTMLVideoElement;

	function onVideoPause() {
		if (ps.type !== 'video' || ps.itemId == null || !videoEl || videoEl.ended) return;
		const pos = Math.floor(videoEl.currentTime);
		if (pos <= 0) return;
		setBookmark(ps.itemId, pos).catch(() => {});
		updateLocalBookmark(ps.itemId, pos);
	}

	onMount(() => {
		mediaPlayer.setElements(audioEl, videoEl);

		document.addEventListener('fullscreenchange', onFullscreenChange);
		// iOS Safari fires these on the video element instead of document
		videoEl.addEventListener('webkitbeginfullscreen', () => { isBrowserFullscreen = true; });
		videoEl.addEventListener('webkitendfullscreen', () => { isBrowserFullscreen = false; });
		videoEl.addEventListener('pause', onVideoPause);
		return () => {
			document.removeEventListener('fullscreenchange', onFullscreenChange);
			videoEl.removeEventListener('pause', onVideoPause);
		};
	});

	const ps = $derived($mediaPlayer);
	const currentAudioTrack = $derived(ps.queue[ps.queueIndex]);
	const showMiniPlayer = $derived(ps.visible && !ps.isFullPlayer);
	const showFullPlayer = $derived(ps.type === 'video' && ps.isFullPlayer);

	// Video element CSS positioning
	const videoClasses = $derived.by(() => {
		if (ps.type !== 'video' || !ps.visible) return 'hidden';
		if (ps.isFullPlayer) return 'fixed inset-0 w-full h-full z-[48] bg-black object-contain';
		// Mini mode: float in the bottom bar area, left side
		return 'fixed bottom-0 left-0 h-[60px] aspect-video z-[51] bg-black object-contain';
	});

	// ── Time formatting ──
	function formatTime(seconds: number): string {
		if (!isFinite(seconds) || seconds < 0) return '0:00';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	// ── Scrubber ──
	function handleSeekClick(e: MouseEvent) {
		const bar = e.currentTarget as HTMLElement;
		const rect = bar.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		if (ps.duration > 0) mediaPlayer.seekTo(ratio * ps.duration);
	}

	function handleSeekTouch(e: TouchEvent) {
		const bar = e.currentTarget as HTMLElement;
		const rect = bar.getBoundingClientRect();
		const touch = e.touches[0];
		const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
		if (ps.duration > 0) mediaPlayer.seekTo(ratio * ps.duration);
	}

	const progress = $derived(
		ps.duration > 0 ? (ps.currentTime / ps.duration) * 100 : 0
	);

	// ── Audio cover ──
	let coverLoaded = $state(false);
	let coverError = $state(false);
	$effect(() => {
		if (currentAudioTrack) {
			coverLoaded = false;
			coverError = false;
		}
	});

	// ── Video loading state ──
	let videoLoading = $state(false);
	let lastVideoItemId: number | null = null;

	$effect(() => {
		const id = ps.type === 'video' ? ps.itemId : null;
		if (id != null && id !== lastVideoItemId) {
			lastVideoItemId = id;
			videoLoading = true;
		}
	});

	function onVideoPlaying() {
		videoLoading = false;
	}

	function onVideoWaiting() {
		videoLoading = true;
	}

	// ── Video bookmark sync ──
	let lastBookmarkSecond = -1;

	function updateLocalBookmark(itemId: number, positionSeconds: number) {
		queryClient.setQueryData(['media', itemId], (old: MediaItemDetail | undefined) => {
			if (!old?.video) return old;
			return { ...old, video: { ...old.video, bookmark_seconds: positionSeconds } };
		});

		const collId = $mediaPlayer.collectionId;
		if (collId == null) return;
		const patchItems = (old: ItemsPage | undefined): ItemsPage | undefined => {
			if (!old) return old;
			return {
				...old,
				items: old.items.map((item) =>
					item.id === itemId && item.video
						? { ...item, video: { ...item.video, bookmark_seconds: positionSeconds } }
						: item
				)
			};
		};
		queryClient.setQueryData(['collection', collId, 'items'], patchItems);
		queryClient.setQueryData(['collection', collId, 'items', 'local'], patchItems);
	}

	function onVideoTimeUpdate() {
		if (!videoEl || ps.type !== 'video') return;
		mediaPlayer.updateCurrentTime(videoEl.currentTime);

		const floor = Math.floor(videoEl.currentTime);
		if (floor > 0 && floor % 15 === 0 && floor !== lastBookmarkSecond) {
			lastBookmarkSecond = floor;
			if (ps.itemId != null) {
				setBookmark(ps.itemId, floor).catch(() => {});
				updateLocalBookmark(ps.itemId, floor);
			}
		}
	}

	function onVideoSeeked() {
		if (!videoEl || ps.type !== 'video' || ps.itemId == null) return;
		const pos = Math.floor(videoEl.currentTime);
		if (pos <= 0) return;
		setBookmark(ps.itemId, pos).catch(() => {});
		updateLocalBookmark(ps.itemId, pos);
	}

	function onVideoEnded() {
		const s = $mediaPlayer;
		if (s.type !== 'video' || s.itemId == null) return;
		clearBookmark(s.itemId).catch(() => {});
		updateLocalBookmark(s.itemId, 0);
		const destId = s.collectionId;
		mediaPlayer.close();
		if (destId != null) goto(`/collection/${destId}`);
	}

	function saveVideoBookmark() {
		const s = $mediaPlayer;
		if (s.type !== 'video' || s.itemId == null || !videoEl) return;
		const currentTime = videoEl.currentTime;
		const duration = videoEl.duration;
		if (currentTime <= 0) return;

		const pos = Math.floor(currentTime);
		if (s.collectionType === 'video:movie') {
			if (isFinite(duration) && duration - currentTime < 300) {
				clearBookmark(s.itemId).catch(() => {});
				updateLocalBookmark(s.itemId, 0);
			} else {
				setBookmark(s.itemId, pos).catch(() => {});
				updateLocalBookmark(s.itemId, pos);
			}
		} else {
			// home movie: no "complete" clear — only save if not at the very end
			if (!isFinite(duration) || currentTime < duration - 1) {
				setBookmark(s.itemId, pos).catch(() => {});
				updateLocalBookmark(s.itemId, pos);
			}
		}
	}

	beforeNavigate(() => {
		saveVideoBookmark();
	});

	// ── Full player controls visibility ──
	let controlsVisible = $state(true);
	let controlsTimer: ReturnType<typeof setTimeout> | null = null;

	function showControls() {
		controlsVisible = true;
		if (controlsTimer) clearTimeout(controlsTimer);
		if (!ps.isPlaying) return;
		controlsTimer = setTimeout(() => {
			controlsVisible = false;
		}, 3000);
	}

	$effect(() => {
		// When playback ps changes, reset controls timer
		if (ps.isPlaying) showControls();
		else controlsVisible = true;
	});

	// ── Fullscreen ──
	let isBrowserFullscreen = $state(false);

	function onFullscreenChange() {
		isBrowserFullscreen = !!document.fullscreenElement;
	}

	async function requestFullscreen() {
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if ((videoEl as any).webkitEnterFullscreen) {
				// iOS Safari: must fullscreen the video element directly
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(videoEl as any).webkitEnterFullscreen();
			} else {
				await document.documentElement.requestFullscreen();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(screen.orientation as any).lock?.('landscape')?.catch(() => {});
			}
		} catch {
			// ignore
		}
	}

	async function exitFullscreen() {
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			if ((videoEl as any).webkitExitFullscreen) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(videoEl as any).webkitExitFullscreen();
			} else {
				await document.exitFullscreen();
			}
		} catch {
			// ignore
		}
	}

	// ── PiP ──
	const canPiP = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;

	async function requestPiP() {
		if (!videoEl || !canPiP) return;
		try {
			if (document.pictureInPictureElement) {
				await document.exitPictureInPicture();
			} else {
				await videoEl.requestPictureInPicture();
			}
		} catch {
			// ignore
		}
	}
</script>

<!-- Always-present audio element for audio playback -->
<!-- svelte-ignore element_invalid_self_closing_tag -->
<audio bind:this={audioEl} class="hidden"></audio>

<!-- Always-present video element — never unmounted, positioned via CSS -->
<!-- svelte-ignore a11y_media_has_caption -->
<video
	bind:this={videoEl}
	class={videoClasses}
	playsinline
	ontimeupdate={onVideoTimeUpdate}
	onplaying={onVideoPlaying}
	onwaiting={onVideoWaiting}
	onseeked={onVideoSeeked}
	onended={onVideoEnded}
></video>

<!-- Video loading spinner (full player) -->
{#if ps.type === 'video' && ps.visible && ps.isFullPlayer && videoLoading}
	<div class="fixed inset-0 z-[50] flex items-center justify-center pointer-events-none">
		<svg class="h-14 w-14 animate-spin text-white/80" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
		</svg>
	</div>
{/if}

<!-- Video loading spinner (mini player thumbnail) -->
{#if ps.type === 'video' && showMiniPlayer && videoLoading}
	<div class="fixed bottom-0 left-0 h-[60px] aspect-video z-[52] flex items-center justify-center bg-black/40">
		<svg class="h-6 w-6 animate-spin text-white/80" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
		</svg>
	</div>
{/if}

<!-- Full player controls overlay -->
{#if showFullPlayer}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[49] flex flex-col"
		onmousemove={showControls}
		ontouchstart={showControls}
		onclick={showControls}
	>
		<!-- Top breadcrumb (hidden in browser fullscreen) -->
		{#if !isBrowserFullscreen}
			<div class="pointer-events-auto flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-4 py-3">
				<button
					class="text-white/80 hover:text-white transition-colors"
					onclick={() => { mediaPlayer.setIsFullPlayer(false); history.back(); }}
					aria-label="Back"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
				<div>
					<p class="text-white text-sm font-medium leading-tight">{ps.title}</p>
					<p class="text-white/70 text-xs">{ps.subtitle}</p>
				</div>
			</div>
		{/if}

		<!-- Bottom controls bar -->
		<div
			class="pointer-events-auto mt-auto bg-gradient-to-t from-black/80 to-transparent px-4 py-4 transition-opacity duration-300"
			class:opacity-0={!controlsVisible}
			class:pointer-events-none={!controlsVisible}
		>
			<!-- Controls row -->
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<!-- Play/Pause -->
					<button
						class="text-white hover:text-white/80 transition-colors p-1"
						onclick={() => (ps.isPlaying ? mediaPlayer.pause() : mediaPlayer.play())}
						aria-label={ps.isPlaying ? 'Pause' : 'Play'}
					>
						{#if ps.isPlaying}
							<svg class="h-10 w-10" fill="currentColor" viewBox="0 0 24 24">
								<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
							</svg>
						{:else}
							<svg class="h-10 w-10" fill="currentColor" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
						{/if}
					</button>
				</div>

				<div class="flex items-center gap-3">
					<!-- PiP -->
					{#if canPiP}
						<button
							class="text-white/80 hover:text-white transition-colors p-1"
							onclick={requestPiP}
							aria-label="Picture in Picture"
						>
							<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<rect x="2" y="4" width="20" height="16" rx="2" />
								<rect x="12" y="11" width="8" height="6" rx="1" fill="currentColor" stroke="none" />
							</svg>
						</button>
					{/if}

					<!-- Fullscreen toggle -->
					<button
						class="text-white/80 hover:text-white transition-colors p-1"
						onclick={isBrowserFullscreen ? exitFullscreen : requestFullscreen}
						aria-label={isBrowserFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
					>
						{#if isBrowserFullscreen}
							<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 9L4 4m0 0v5m0-5h5M15 9l5-5m0 0v5m0-5h-5M9 15l-5 5m0 0v-5m0 5h5M15 15l5 5m0 0v-5m0 5h-5" />
							</svg>
						{:else}
							<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
							</svg>
						{/if}
					</button>
				</div>
			</div>

			<!-- Time + scrubber -->
			<div class="mt-3 flex items-center gap-3">
				<span class="text-white/80 text-xs tabular-nums w-10 text-right">{formatTime(ps.currentTime)}</span>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="flex-1 h-1 bg-white/30 rounded-full cursor-pointer relative"
					onclick={handleSeekClick}
					ontouchmove={handleSeekTouch}
				>
					<div class="absolute inset-y-0 left-0 bg-white rounded-full" style="width: {progress}%"></div>
				</div>
				<span class="text-white/80 text-xs tabular-nums w-10">{formatTime(ps.duration)}</span>
			</div>
		</div>
	</div>
{/if}

<!-- Mini player bar -->
{#if showMiniPlayer}
	<div
		class="fixed inset-x-0 bottom-0 z-50 bg-surface-raised border-t border-border shadow-lg pb-safe"
		class:pl-[110px]={ps.type === 'video'}
	>
		<!-- Progress bar (thin line above controls) -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="h-1 w-full cursor-pointer bg-border"
			onclick={handleSeekClick}
			ontouchmove={handleSeekTouch}
		>
			<div
				class="bg-accent h-full transition-[width] duration-100"
				style="width: {progress}%"
			></div>
		</div>

		{#if ps.type === 'audio' && currentAudioTrack}
			<!-- ── Audio mini player ── -->
			<div class="flex items-center gap-3 px-3 py-2">
				<!-- Album art thumbnail -->
				<div class="bg-surface relative h-10 w-10 flex-shrink-0 overflow-hidden rounded">
					{#if !coverError}
						<img
							src={ps.thumbnailUrl ?? ''}
							alt=""
							class="h-full w-full object-cover"
							class:opacity-0={!coverLoaded}
							onload={() => (coverLoaded = true)}
							onerror={() => (coverError = true)}
						/>
					{/if}
					{#if !coverLoaded || coverError}
						<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-raised to-border">
							<svg class="text-text-muted h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
							</svg>
						</div>
					{/if}
				</div>

				<!-- Track info -->
				<div class="min-w-0 flex-1">
					<p class="text-text-primary truncate text-sm font-medium">{ps.title}</p>
					<p class="text-text-muted truncate text-xs">{ps.subtitle}</p>
				</div>

				<!-- Time display -->
				<span class="text-text-muted hidden text-xs tabular-nums sm:block">
					{formatTime(ps.currentTime)} / {formatTime(ps.duration)}
				</span>

				<!-- Controls -->
				<div class="flex items-center gap-1">
					<button
						class="text-text-secondary hover:text-text-primary p-1.5 transition-colors"
						onclick={() => mediaPlayer.previous()}
						aria-label="Previous track"
					>
						<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
							<path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
						</svg>
					</button>

					<button
						class="text-text-primary hover:text-accent p-1.5 transition-colors"
						onclick={() => (ps.isPlaying ? mediaPlayer.pause() : mediaPlayer.play())}
						aria-label={ps.isPlaying ? 'Pause' : 'Play'}
					>
						{#if ps.isPlaying}
							<svg class="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
								<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
							</svg>
						{:else}
							<svg class="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
						{/if}
					</button>

					<button
						class="text-text-secondary hover:text-text-primary p-1.5 transition-colors"
						onclick={() => mediaPlayer.next()}
						aria-label="Next track"
					>
						<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
							<path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
						</svg>
					</button>

					<button
						class="hidden p-1.5 transition-colors sm:block"
						class:text-accent={ps.shuffle}
						class:text-text-muted={!ps.shuffle}
						onclick={() => mediaPlayer.toggleShuffle()}
						aria-label="Toggle shuffle"
					>
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
							<path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
						</svg>
					</button>

					<button
						class="hidden p-1.5 transition-colors sm:block"
						class:text-accent={ps.repeat !== 'none'}
						class:text-text-muted={ps.repeat === 'none'}
						onclick={() => mediaPlayer.toggleRepeat()}
						aria-label="Toggle repeat"
					>
						{#if ps.repeat === 'one'}
							<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
								<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
							</svg>
						{:else}
							<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
								<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
							</svg>
						{/if}
					</button>

					<button
						class="text-text-muted hover:text-text-primary p-1.5 transition-colors"
						onclick={() => mediaPlayer.close()}
						aria-label="Close player"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

		{:else if ps.type === 'video'}
			<!-- ── Video mini player ── -->
			<!-- The <video> element is absolutely positioned at left-0 bottom-0; this section is the right-side info+controls -->
			<div class="flex items-center gap-3 px-3 py-2">
				<!-- Clickable title area → navigate to watch page -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="min-w-0 flex-1 cursor-pointer"
					onclick={() => goto(`/watch/${ps.itemId}`)}
				>
					<p class="text-text-primary truncate text-sm font-medium">{ps.title}</p>
					<p class="text-text-muted truncate text-xs">{ps.subtitle}</p>
				</div>

				<span class="text-text-muted hidden text-xs tabular-nums sm:block">
					{formatTime(ps.currentTime)} / {formatTime(ps.duration)}
				</span>

				<div class="flex items-center gap-1">
					<!-- Play/Pause -->
					<button
						class="text-text-primary hover:text-accent p-1.5 transition-colors"
						onclick={() => (ps.isPlaying ? mediaPlayer.pause() : mediaPlayer.play())}
						aria-label={ps.isPlaying ? 'Pause' : 'Play'}
					>
						{#if ps.isPlaying}
							<svg class="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
								<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
							</svg>
						{:else}
							<svg class="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
						{/if}
					</button>

					<!-- PiP -->
					{#if canPiP}
						<button
							class="text-text-muted hover:text-text-primary p-1.5 transition-colors"
							onclick={requestPiP}
							aria-label="Picture in Picture"
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<rect x="2" y="4" width="20" height="16" rx="2" />
								<rect x="12" y="11" width="8" height="6" rx="1" fill="currentColor" stroke="none" />
							</svg>
						</button>
					{/if}

					<!-- Close -->
					<button
						class="text-text-muted hover:text-text-primary p-1.5 transition-colors"
						onclick={() => { saveVideoBookmark(); mediaPlayer.close(); }}
						aria-label="Close player"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

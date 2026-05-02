<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { mediaPlayer } from '$lib/stores/mediaPlayer';
	import { setBookmark, clearBookmark } from '$lib/api/video';
	import type { VideoItemView } from '$lib/types';
	import type { ItemsPage } from '$lib/api/collections';
	import BackButton from './BackButton.svelte';
	import PlayPauseFeedback from './PlayPauseFeedback.svelte';
	import {
		IconMusic,
		IconPlay,
		IconPause,
		IconPrevTrack,
		IconNextTrack,
		IconShuffle,
		IconRepeat,
		IconRepeatOne,
		IconClose,
		IconPip,
		IconFullscreenEnter,
		IconFullscreenExit,
		IconSpinner
	} from './icons';

	const queryClient = useQueryClient();

	let audioEl: HTMLAudioElement;
	let videoEl: HTMLVideoElement;

	function onVideoPause() {
		if (ps.type !== 'video' || ps.itemId == null || ps.collectionId == null || !videoEl || videoEl.ended) return;
		const pos = Math.floor(videoEl.currentTime);
		if (pos <= 0) return;
		setBookmark(ps.collectionId, ps.itemId, pos).catch(() => {});
		updateLocalBookmark(ps.itemId, pos);
	}

	function onKeyDown(e: KeyboardEvent) {
		const s = $mediaPlayer;
		if (s.type !== 'video' || !s.isFullPlayer) return;
		if (e.key === ' ') {
			e.preventDefault();
			togglePlayWithFeedback();
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			if (videoEl) mediaPlayer.seekTo(Math.max(0, videoEl.currentTime - 10));
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			if (videoEl) mediaPlayer.seekTo(Math.min(isFinite(s.duration) ? s.duration : Infinity, videoEl.currentTime + 10));
		}
	}

	onMount(() => {
		mediaPlayer.setElements(audioEl, videoEl);

		document.addEventListener('fullscreenchange', onFullscreenChange);
		document.addEventListener('keydown', onKeyDown);
		// iOS Safari fires these on the video element instead of document
		videoEl.addEventListener('webkitbeginfullscreen', () => { isBrowserFullscreen = true; });
		videoEl.addEventListener('webkitendfullscreen', () => { isBrowserFullscreen = false; });
		videoEl.addEventListener('pause', onVideoPause);
		return () => {
			document.removeEventListener('fullscreenchange', onFullscreenChange);
			document.removeEventListener('keydown', onKeyDown);
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
		if (ps.duration > 0 && isFinite(ps.duration)) mediaPlayer.seekTo(ratio * ps.duration);
	}

	function handleSeekTouch(e: TouchEvent) {
		const bar = e.currentTarget as HTMLElement;
		const rect = bar.getBoundingClientRect();
		const touch = e.touches[0];
		const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
		if (ps.duration > 0 && isFinite(ps.duration)) mediaPlayer.seekTo(ratio * ps.duration);
	}

	const progress = $derived(
		ps.duration > 0 && isFinite(ps.duration) ? (ps.currentTime / ps.duration) * 100 : 0
	);

	// ── Audio cover ──
	let coverLoaded = $state(false);
	let coverError = $state(false);
	let lastCoverUrl = $state<string | null>(null);
	$effect(() => {
		const url = ps.thumbnailUrl;
		if (url !== lastCoverUrl) {
			lastCoverUrl = url;
			coverLoaded = false;
			coverError = false;
		}
	});

	// ── Video loading state ──
	// Only show spinner on initial load (new video), not during HTTP rebuffering.
	// For raw MP4 over HTTP, the browser fires waiting/playing in rapid cycles as
	// the download catches up to playback, which makes the spinner appear permanent.
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

	function onVideoCanPlay() {
		videoLoading = false;
	}

	// Intentionally not using onVideoWaiting to set videoLoading = true.
	// HTTP progressive download fires waiting/playing constantly as the buffer
	// fills; this keeps the initial-load spinner from re-appearing during playback.

	// ── Video bookmark sync ──
	let lastBookmarkSecond = -1;

	function updateLocalBookmark(itemId: number, positionSeconds: number) {
		const collId = $mediaPlayer.collectionId;
		if (collId == null) return;
		const patchItems = (old: ItemsPage | undefined): ItemsPage | undefined => {
			if (!old) return old;
			return {
				...old,
				items: old.items.map((item: VideoItemView) =>
					item.id === itemId
						? { ...item, bookmark_seconds: positionSeconds }
						: item
				)
			};
		};
		queryClient.setQueryData(['collection', collId, 'videos'], patchItems);
		queryClient.setQueryData(['collection', collId, 'videos', 'local'], patchItems);
	}

	function onVideoTimeUpdate() {
		if (!videoEl || ps.type !== 'video') return;
		// timeupdate firing means the video is producing frames — clear the spinner
		if (videoLoading) videoLoading = false;
		mediaPlayer.updateCurrentTime(videoEl.currentTime, videoEl.duration);

		const floor = Math.floor(videoEl.currentTime);
		if (floor > 0 && floor % 15 === 0 && floor !== lastBookmarkSecond) {
			lastBookmarkSecond = floor;
			if (ps.itemId != null && ps.collectionId != null) {
				setBookmark(ps.collectionId, ps.itemId, floor).catch(() => {});
				updateLocalBookmark(ps.itemId, floor);
			}
		}
	}

	function onVideoSeeked() {
		if (!videoEl || ps.type !== 'video' || ps.itemId == null || ps.collectionId == null) return;
		const pos = Math.floor(videoEl.currentTime);
		if (pos <= 0) return;
		setBookmark(ps.collectionId, ps.itemId, pos).catch(() => {});
		updateLocalBookmark(ps.itemId, pos);
	}

	function onVideoEnded() {
		const s = $mediaPlayer;
		if (s.type !== 'video' || s.itemId == null) return;
		if (s.collectionId != null) clearBookmark(s.collectionId, s.itemId).catch(() => {});
		updateLocalBookmark(s.itemId, 0);
		const dest = s.collectionPath;
		mediaPlayer.close();
		if (dest) goto(dest);
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
				if (s.collectionId != null) clearBookmark(s.collectionId, s.itemId).catch(() => {});
				updateLocalBookmark(s.itemId, 0);
			} else {
				if (s.collectionId != null) setBookmark(s.collectionId, s.itemId, pos).catch(() => {});
				updateLocalBookmark(s.itemId, pos);
			}
		} else {
			// home movie: no "complete" clear — only save if not at the very end
			if (!isFinite(duration) || currentTime < duration - 1) {
				if (s.collectionId != null) setBookmark(s.collectionId, s.itemId, pos).catch(() => {});
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

	// ── Play/pause feedback animation ──
	let feedbackPlaying = $state(false);
	let feedbackKey = $state(0);

	function togglePlayWithFeedback() {
		const nowPlaying = !$mediaPlayer.isPlaying;
		if (nowPlaying) mediaPlayer.play(); else mediaPlayer.pause();
		feedbackPlaying = nowPlaying;
		feedbackKey += 1;
		showControls();
	}

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
	oncanplay={onVideoCanPlay}
	onseeked={onVideoSeeked}
	onended={onVideoEnded}
	class:cursor-pointer={!ps.isFullPlayer}
	onclick={() => { if (!ps.isFullPlayer && ps.watchPath) goto(ps.watchPath); }}
></video>

<!-- Video loading spinner (full player) -->
{#if ps.type === 'video' && ps.visible && ps.isFullPlayer && videoLoading}
	<div class="fixed inset-0 z-[50] flex items-center justify-center pointer-events-none">
		<IconSpinner class="h-14 w-14 animate-spin text-white/80" />
	</div>
{/if}

<!-- Video loading spinner (mini player thumbnail) -->
{#if ps.type === 'video' && showMiniPlayer && videoLoading}
	<div class="fixed bottom-0 left-0 h-[60px] aspect-video z-[52] flex items-center justify-center bg-black/40">
		<IconSpinner class="h-6 w-6 animate-spin text-white/80" />
	</div>
{/if}

<!-- Play/pause feedback flash -->
{#if showFullPlayer}
	<PlayPauseFeedback playing={feedbackPlaying} {feedbackKey} class="fixed inset-0 z-[50]" />
{/if}

<!-- Full player controls overlay -->
{#if showFullPlayer}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[49] flex flex-col select-none"
		onmousemove={showControls}
		ontouchstart={showControls}
		onclick={togglePlayWithFeedback}
	>
		<!-- Top breadcrumb (hidden in browser fullscreen) -->
		{#if !isBrowserFullscreen}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="pointer-events-auto flex items-center bg-gradient-to-b from-black/60 to-transparent px-4 py-3"
				onclick={(e) => e.stopPropagation()}
			>
				<BackButton onclick={() => { mediaPlayer.setIsFullPlayer(false); if (ps.collectionPath) goto(ps.collectionPath); else history.back(); }} />
			</div>
		{/if}

		<!-- Bottom controls bar -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="pointer-events-auto mt-auto bg-gradient-to-t from-black/80 to-transparent px-4 py-4 transition-opacity duration-300"
			class:opacity-0={!controlsVisible}
			class:pointer-events-none={!controlsVisible}
			onclick={(e) => e.stopPropagation()}
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
							<IconPause class="h-10 w-10" />
						{:else}
							<IconPlay class="h-10 w-10" />
						{/if}
					</button>
				</div>

				<div class="flex items-center gap-3">
					<!-- PiP -->
					{#if canPiP}
						<button
							class="text-white hover:text-white/80 transition-colors p-1"
							onclick={requestPiP}
							aria-label="Picture in Picture"
						>
							<IconPip class="h-6 w-6" />
						</button>
					{/if}

					<!-- Fullscreen toggle -->
					<button
						class="text-white hover:text-white/80 transition-colors p-1"
						onclick={isBrowserFullscreen ? exitFullscreen : requestFullscreen}
						aria-label={isBrowserFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
					>
						{#if isBrowserFullscreen}
							<IconFullscreenExit class="h-6 w-6" />
						{:else}
							<IconFullscreenEnter class="h-6 w-6" />
						{/if}
					</button>
				</div>
			</div>

			<!-- Time + scrubber -->
			<div class="mt-3 flex items-center gap-3">
				<span class="text-white text-xs tabular-nums w-10 text-right">{formatTime(ps.currentTime)}</span>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="flex-1 h-1 bg-white/30 rounded-full cursor-pointer relative"
					onclick={handleSeekClick}
					ontouchmove={handleSeekTouch}
				>
					<div class="absolute inset-y-0 left-0 bg-white rounded-full" style="width: {progress}%"></div>
				</div>
				<span class="text-white text-xs tabular-nums w-10">{formatTime(ps.duration)}</span>
			</div>
		</div>
	</div>
{/if}

<!-- Mini player bar -->
{#if showMiniPlayer}
	<div
		class="bg-surface-raised border-t border-border shadow-lg pb-safe select-none"
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
				<!-- Clickable area: cover art + track info → navigate to album/show page -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="flex min-w-0 flex-1 items-center gap-3"
					class:cursor-pointer={!!ps.collectionPath}
					onclick={() => ps.collectionPath && goto(ps.collectionPath)}
				>
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
								<IconMusic class="text-text-muted h-5 w-5" />
							</div>
						{/if}
					</div>

					<!-- Track info -->
					<div class="min-w-0 flex-1">
						<p class="text-text-primary truncate text-sm font-medium">{ps.title}</p>
						<p class="text-text-secondary truncate text-xs">{ps.subtitle}</p>
					</div>
				</div>

				<!-- Time display -->
				<span class="text-text-secondary hidden text-xs tabular-nums sm:block">
					{formatTime(ps.currentTime)} / {formatTime(ps.duration)}
				</span>

				<!-- Controls -->
				<div class="flex items-center gap-1">
					<button
						class="text-text-secondary hover:text-text-primary p-1.5 transition-colors"
						onclick={() => mediaPlayer.previous()}
						aria-label="Previous track"
					>
						<IconPrevTrack class="h-5 w-5" />
					</button>

					<button
						class="text-text-primary hover:text-accent p-1.5 transition-colors"
						onclick={() => (ps.isPlaying ? mediaPlayer.pause() : mediaPlayer.play())}
						aria-label={ps.isPlaying ? 'Pause' : 'Play'}
					>
						{#if ps.isPlaying}
							<IconPause class="h-7 w-7" />
						{:else}
							<IconPlay class="h-7 w-7" />
						{/if}
					</button>

					<button
						class="text-text-secondary hover:text-text-primary p-1.5 transition-colors"
						onclick={() => mediaPlayer.next()}
						aria-label="Next track"
					>
						<IconNextTrack class="h-5 w-5" />
					</button>

					<button
						class="hidden p-1.5 transition-colors hover:text-yellow-300 sm:block"
						class:text-accent={ps.shuffle}
						class:text-text-secondary={!ps.shuffle}
						onclick={() => mediaPlayer.toggleShuffle()}
						aria-label="Toggle shuffle"
					>
						<IconShuffle class="h-4 w-4" />
					</button>

					<button
						class="hidden p-1.5 transition-colors hover:text-yellow-300 sm:block"
						class:text-accent={ps.repeat !== 'none'}
						class:text-text-secondary={ps.repeat === 'none'}
						onclick={() => mediaPlayer.toggleRepeat()}
						aria-label="Toggle repeat"
					>
						{#if ps.repeat === 'one'}
							<IconRepeatOne class="h-4 w-4" />
						{:else}
							<IconRepeat class="h-4 w-4" />
						{/if}
					</button>

					<button
						class="text-text-secondary hover:text-warning p-1.5 transition-colors"
						onclick={() => mediaPlayer.close()}
						aria-label="Close player"
					>
						<IconClose class="h-4 w-4" />
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
					onclick={() => ps.watchPath && goto(ps.watchPath)}
				>
					<p class="text-text-primary truncate text-sm font-medium">{ps.title}</p>
					<p class="text-text-secondary truncate text-xs">{ps.subtitle}</p>
				</div>

				<span class="text-text-secondary hidden text-xs tabular-nums sm:block">
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
							<IconPause class="h-7 w-7" />
						{:else}
							<IconPlay class="h-7 w-7" />
						{/if}
					</button>

					<!-- PiP -->
					{#if canPiP}
						<button
							class="text-text-muted hover:text-text-primary p-1.5 transition-colors"
							onclick={requestPiP}
							aria-label="Picture in Picture"
						>
							<IconPip class="h-5 w-5" />
						</button>
					{/if}

					<!-- Close -->
					<button
						class="text-text-muted hover:text-text-primary p-1.5 transition-colors"
						onclick={() => { saveVideoBookmark(); mediaPlayer.close(); }}
						aria-label="Close player"
					>
						<IconClose class="h-4 w-4" />
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

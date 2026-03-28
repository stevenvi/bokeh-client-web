<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { getMediaItem } from '$lib/api/media';
	import { imageVariantUrl } from '$lib/api/media';
	import { slideshowPage } from '$lib/api/collections';
	import { selectVariant } from '$lib/utils/variant';
	import type { SlideshowItem, MediaItemDetail } from '$lib/types';
	import SlideshowImage from './SlideshowImage.svelte';
	import SlideshowOverlay from './SlideshowOverlay.svelte';

	interface Props {
		collectionId: number;
		autoplay: boolean;
		order: 'asc' | 'desc';
		recursive: boolean;
		startItem?: number | null;
		startIndex: number;
		initialItems?: SlideshowItem[];
		collectionName?: string;
	}

	let {
		collectionId,
		autoplay,
		order,
		recursive,
		startItem = null,
		startIndex,
		initialItems = [],
		collectionName = ''
	}: Props = $props();

	// svelte-ignore state_referenced_locally -- intentional initial-value fork; these props don't change after mount
	let items = $state<SlideshowItem[]>([...initialItems]);
	// svelte-ignore state_referenced_locally
	let currentIndex = $state(startIndex);
	let nextCursor = $state<string | null>(null);
	let prevCursor = $state<string | null>(null);
	// svelte-ignore state_referenced_locally
	let playing = $state(autoplay);
	let showOverlay = $state(true);
	let detailCache = $state(new Map<number, MediaItemDetail>());
	let loadingPrev = $state(false);

	// Strip transition state — the strip holds [prev, current, next] side by side.
	// Normal position: translateX(-33.333%) so the center slot is visible.
	let stripAnimated = $state(false);
	let stripOffsetPx = $state(0); // extra pixel offset from center (for swipe + animation)
	let transitioning = $state(false);

	// Swipe state
	let swipeStartX = 0;
	let swipeCurrentX = $state(0);
	let swiping = $state(false);

	let zoomed = $state(false);
	let overlayHideTimer: ReturnType<typeof setTimeout> | null = null;
	let playTimer: ReturnType<typeof setInterval> | null = null;

	// Play/pause feedback: a brief centered icon flash on toggle.
	// feedbackKey increments on each toggle so the element re-mounts and replays the animation.
	let feedbackPlaying = $state(false);
	let feedbackKey = $state(0);

	const currentItem = $derived(items[currentIndex] ?? null);
	const prevItem = $derived(currentIndex > 0 ? items[currentIndex - 1] : null);
	const nextItem = $derived(currentIndex < items.length - 1 ? items[currentIndex + 1] : null);
	const hasPrev = $derived(currentIndex > 0 || prevCursor !== null);
	const hasNext = $derived(currentIndex < items.length - 1 || nextCursor !== null);

	const variant = $derived(selectVariant(window.innerWidth, window.innerHeight));

	// Preload ±2 images into the browser cache
	$effect(() => {
		const indices = [
			currentIndex,     // current (highest priority)
			currentIndex + 1, // next
			currentIndex - 1, // prev
			currentIndex + 2, // next+1
			currentIndex - 2  // prev-1
		];
		for (const idx of indices) {
			if (idx >= 0 && idx < items.length) {
				const url = imageVariantUrl(items[idx].id, variant);
				const img = new Image();
				img.src = url;
			}
		}
	});

	onMount(async () => {
		if (items.length === 0) {
			await loadInitial();
		}
		scheduleOverlayHide();
	});

	onDestroy(() => {
		if (playTimer) clearInterval(playTimer);
		if (overlayHideTimer) clearTimeout(overlayHideTimer);
	});

	async function loadInitial() {
		const page = await slideshowPage(collectionId, {
			order,
			recursive,
			start: startItem
		});
		items = [...items, ...page.items];
		nextCursor = page.next_cursor;
		prevCursor = page.prev_cursor;
	}

	async function loadNext() {
		if (!nextCursor) return;
		const page = await slideshowPage(collectionId, {
			order,
			recursive,
			cursor: nextCursor
		});
		items = [...items, ...page.items];
		nextCursor = page.next_cursor;
	}

	async function loadPrev() {
		if (!prevCursor || loadingPrev) return;
		loadingPrev = true;
		const page = await slideshowPage(collectionId, {
			order,
			recursive,
			cursor: prevCursor
		});
		const newItems = page.items;
		items = [...newItems, ...items];
		currentIndex += newItems.length;
		prevCursor = page.prev_cursor;
		loadingPrev = false;
	}

	// Prefetch next page when nearing the end
	$effect(() => {
		if (currentItem && currentIndex >= items.length - 3 && nextCursor !== null) {
			loadNext();
		}
	});

	// Prefetch previous page when nearing the start
	$effect(() => {
		if (currentIndex <= 2 && prevCursor !== null && !loadingPrev) {
			loadPrev();
		}
	});

	$effect(() => {
		if (showOverlay && currentItem && !detailCache.has(currentItem.id)) {
			getMediaItem(currentItem.id).then((detail) => {
				detailCache = new Map(detailCache).set(currentItem.id, detail);
			});
		}
	});

	$effect(() => {
		if (playing) {
			playTimer = setInterval(() => advance(1), 5000);
		} else {
			if (playTimer) clearInterval(playTimer);
			playTimer = null;
		}
		return () => {
			if (playTimer) clearInterval(playTimer);
		};
	});

	async function advance(dir: 1 | -1) {
		const next = currentIndex + dir;
		if (next < 0 || next >= items.length) return;
		if (transitioning) return;
		transitioning = true;

		// Reset autoplay timer so the full interval starts from this slide
		if (playing && playTimer) {
			clearInterval(playTimer);
			playTimer = setInterval(() => advance(1), 5000);
		}

		// Animate the strip to reveal the adjacent slot
		stripAnimated = true;
		stripOffsetPx = dir === 1 ? -window.innerWidth : window.innerWidth;

		setTimeout(async () => {
			// Update content while the center slot is still off-screen (strip at offset).
			// This ensures the center has the correct new item before it becomes visible.
			stripAnimated = false;
			currentIndex = next;
			await tick();
			// Now snap back — center slot already has new content, no flicker.
			stripOffsetPx = 0;
			transitioning = false;
		}, 250);
	}

	function handlePrev() { advance(-1); }
	function handleNext() { advance(1); }
	function handleTogglePlay() {
		playing = !playing;
		feedbackPlaying = playing;
		feedbackKey += 1;
	}
	function handleBack() { history.back(); }

	function scheduleOverlayHide() {
		if (overlayHideTimer) clearTimeout(overlayHideTimer);
		overlayHideTimer = setTimeout(() => { showOverlay = false; }, 3000);
	}

	function handleInteraction() {
		showOverlay = true;
		scheduleOverlayHide();
	}

	// Swipe handling
	function onTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1 || transitioning) return;
		swipeStartX = e.touches[0].clientX;
		swipeCurrentX = 0;
		swiping = true;
	}

	function onTouchMove(e: TouchEvent) {
		if (!swiping || e.touches.length !== 1) return;
		const dx = e.touches[0].clientX - swipeStartX;
		if (dx > 0 && !hasPrev) { swipeCurrentX = dx * 0.2; return; }
		if (dx < 0 && !hasNext) { swipeCurrentX = dx * 0.2; return; }
		swipeCurrentX = dx;
	}

	async function onTouchEnd() {
		if (!swiping) return;
		swiping = false;
		const threshold = window.innerWidth * 0.2;
		const dx = swipeCurrentX;
		swipeCurrentX = 0;

		if (Math.abs(dx) > threshold) {
			const dir = dx < 0 ? 1 : -1;
			const next = currentIndex + dir;
			if (next >= 0 && next < items.length) {
				transitioning = true;
				// Start from the swipe position and animate to the target
				stripOffsetPx = dx;
				stripAnimated = false;
				await tick();
				stripAnimated = true;
				stripOffsetPx = dir === 1 ? -window.innerWidth : window.innerWidth;
				setTimeout(async () => {
					stripAnimated = false;
					currentIndex = next;
					await tick();
					stripOffsetPx = 0;
					transitioning = false;
				}, 250);
				return;
			}
		}

		// Snap back to center
		stripOffsetPx = dx;
		stripAnimated = false;
		await tick();
		stripAnimated = true;
		stripOffsetPx = 0;
		setTimeout(() => { stripAnimated = false; }, 250);
	}

	// Keyboard navigation
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') { handleInteraction(); advance(-1); }
		else if (e.key === 'ArrowRight') { handleInteraction(); advance(1); }
		else if (e.key === ' ') { e.preventDefault(); handleInteraction(); handleTogglePlay(); }
		else if (e.key === 'Escape') {
			if (zoomed) {
				zoomed = false;
			} else {
				handleBack();
			}
		}
	}

	// Strip transform: base at -33.333% (center slot visible), offset by swipe/animation px
	const stripTransform = $derived(() => {
		const swipeOffset = swiping ? swipeCurrentX : stripOffsetPx;
		if (swipeOffset === 0) return 'translateX(-33.333%)';
		return `translateX(calc(-33.333% + ${swipeOffset}px))`;
	});
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 overflow-hidden bg-black"
	onclick={handleInteraction}
	onmousemove={handleInteraction}
	ontouchstart={onTouchStart}
	ontouchmove={onTouchMove}
	ontouchend={onTouchEnd}
	role="presentation"
>
	{#if !currentItem}
		<div class="flex h-full items-center justify-center">
			<div class="border-accent h-10 w-10 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else}
		<!-- 3-slot strip: [prev] [current] [next] -->
		<div
			class="flex h-full"
			class:strip-transition={stripAnimated && !swiping}
			style="width: 300%; transform: {stripTransform()}"
		>
			<!-- Previous image -->
			<div class="h-full" style="width: calc(100% / 3)">
				{#if prevItem}
					<img
						src={imageVariantUrl(prevItem.id, variant)}
						alt={prevItem.title}
						class="strip-img"
					/>
				{/if}
			</div>

			<!-- Current image (full SlideshowImage with DZI support) -->
			<div class="h-full" style="width: calc(100% / 3)">
				<SlideshowImage
					item={currentItem}
					active={true}
					{zoomed}
					onZoom={() => zoomed = true}
					onZoomExit={() => zoomed = false}
				/>
			</div>

			<!-- Next image -->
			<div class="h-full" style="width: calc(100% / 3)">
				{#if nextItem}
					<img
						src={imageVariantUrl(nextItem.id, variant)}
						alt={nextItem.title}
						class="strip-img"
					/>
				{/if}
			</div>
		</div>

		<!-- Play/pause feedback flash — re-keyed on every toggle to replay the animation -->
		{#key feedbackKey}
			{#if feedbackKey > 0}
				<div class="play-feedback pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
					<div class="play-feedback-icon rounded-full bg-black/50 p-6">
						{#if feedbackPlaying}
							<svg class="h-16 w-16 text-white" fill="currentColor" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z" />
							</svg>
						{:else}
							<svg class="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
							</svg>
						{/if}
					</div>
				</div>
			{/if}
		{/key}

		{#if showOverlay && !zoomed}
			<SlideshowOverlay
				item={currentItem}
				detail={detailCache.get(currentItem.id) ?? null}
				{collectionName}
				{playing}
				{hasPrev}
				{hasNext}
				onPrev={handlePrev}
				onNext={handleNext}
				onTogglePlay={handleTogglePlay}
				onBack={handleBack}
			/>
		{/if}
	{/if}
</div>

<style>
	.strip-transition {
		transition: transform 250ms ease-out;
	}

	.strip-img {
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		object-fit: contain;
	}

	.play-feedback {
		animation: play-feedback-fade 700ms ease-out forwards;
	}

	.play-feedback-icon {
		animation: play-feedback-scale 700ms ease-out forwards;
	}

	@keyframes play-feedback-fade {
		0%   { opacity: 0; }
		15%  { opacity: 1; }
		65%  { opacity: 1; }
		100% { opacity: 0; }
	}

	@keyframes play-feedback-scale {
		0%   { transform: scale(0.7); }
		15%  { transform: scale(1); }
		100% { transform: scale(1.15); }
	}
</style>

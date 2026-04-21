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
	let showOverlay = $state(false);
	let detailCache = $state(new Map<number, MediaItemDetail>());
	let loadingPrev = $state(false);

	// Slide transition state — each slide is absolutely positioned and translated.
	// slideOffsetPx shifts all slides in unison (for animation and swiping).
	let slideOffsetPx = $state(0);
	let slideAnimated = $state(false);
	let slideEasing = $state<'ease-out' | 'linear'>('ease-out');
	let transitioning = $state(false);
	let pendingDir = $state<1 | -1 | null>(null);
	let slidesContainer: HTMLDivElement | null = $state(null);
	let safetyTimer: ReturnType<typeof setTimeout> | null = null;
	let transitionHandled = false;

	// Swipe state
	let swipeStartX = 0;
	let swiping = $state(false);

	let zoomed = $state(false);
	let justExitedZoom = $state(false);
	let overlayHideTimer: ReturnType<typeof setTimeout> | null = null;
	let playTimer: ReturnType<typeof setInterval> | null = null;

	// Play/pause feedback: a brief centered icon flash on toggle.
	// feedbackKey increments on each toggle so the element re-mounts and replays the animation.
	let feedbackPlaying = $state(false);
	let feedbackKey = $state(0);

	const currentItem = $derived(items[currentIndex] ?? null);
	const hasPrev = $derived(currentIndex > 0 || prevCursor !== null);
	const hasNext = $derived(currentIndex < items.length - 1 || nextCursor !== null);

	const variant = $derived(selectVariant(window.innerWidth, window.innerHeight));

	// Visible slides: current item ± 1, keyed by item id so DOM elements persist
	// across index changes — no img src swaps, no flicker.
	const visibleSlides = $derived.by(() => {
		const result: Array<{ index: number; item: SlideshowItem }> = [];
		for (let i = currentIndex - 1; i <= currentIndex + 1; i++) {
			if (i >= 0 && i < items.length) {
				result.push({ index: i, item: items[i] });
			}
		}
		return result;
	});

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
	});

	onDestroy(() => {
		if (playTimer) clearInterval(playTimer);
		if (overlayHideTimer) clearTimeout(overlayHideTimer);
		if (safetyTimer) clearTimeout(safetyTimer);
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

	function advance(dir: 1 | -1) {
		const next = currentIndex + dir;
		if (next < 0 || next >= items.length) return;

		if (transitioning) {
			// Buffer at most one pending advance (replaces any existing pending)
			pendingDir = dir;
			return;
		}

		beginSlide(dir, false);
	}

	function beginSlide(dir: 1 | -1, chained: boolean) {
		transitionHandled = false;
		transitioning = true;

		// Reset autoplay timer so the full interval starts from this slide
		if (playing && playTimer) {
			clearInterval(playTimer);
			playTimer = setInterval(() => advance(1), 5000);
		}

		slideEasing = chained ? 'linear' : 'ease-out';
		slideAnimated = true;
		slideOffsetPx = dir === 1 ? -window.innerWidth : window.innerWidth;

		// Safety timeout in case transitionend doesn't fire
		if (safetyTimer) clearTimeout(safetyTimer);
		safetyTimer = setTimeout(() => {
			safetyTimer = null;
			if (transitioning && slideOffsetPx !== 0) {
				transitionHandled = true;
				finishSlide();
			}
		}, 350);
	}

	function onSlideTransitionEnd(e: TransitionEvent) {
		if (e.propertyName !== 'transform' || !transitioning || transitionHandled) return;
		transitionHandled = true;
		if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }

		if (slideOffsetPx === 0) {
			// Snap-back from swipe that didn't meet threshold
			slideAnimated = false;
			transitioning = false;
			return;
		}

		finishSlide();
	}

	async function finishSlide() {
		const dir = slideOffsetPx < 0 ? 1 : -1;
		const next = currentIndex + dir;

		const pending = pendingDir;
		pendingDir = null;

		// Batch all updates in one synchronous block.
		// Because slides are keyed by item id, persisting slides keep
		// their DOM elements — no src change, no flicker.
		// The transform recalculation yields the same visual positions.
		slideAnimated = false;
		currentIndex = next;
		slideOffsetPx = 0;

		if (pending !== null) {
			const pendingNext = next + pending;
			if (pendingNext >= 0 && pendingNext < items.length) {
				// Flush DOM so the new slide element exists at its rest position
				await tick();

				// Use rAF to guarantee the browser has processed a layout pass
				// with the new element at its initial position. A reflow inside
				// the rAF commits that position, then setting the target in the
				// same callback triggers a proper CSS transition.
				const pendingCopy = pending;
				requestAnimationFrame(() => {
					if (slidesContainer) void slidesContainer.offsetHeight;

					transitionHandled = false;
					slideEasing = 'linear';
					slideAnimated = true;
					slideOffsetPx = pendingCopy === 1 ? -window.innerWidth : window.innerWidth;

					if (playing && playTimer) {
						clearInterval(playTimer);
						playTimer = setInterval(() => advance(1), 5000);
					}
					if (safetyTimer) clearTimeout(safetyTimer);
					safetyTimer = setTimeout(() => {
						safetyTimer = null;
						if (transitioning && slideOffsetPx !== 0) {
							transitionHandled = true;
							finishSlide();
						}
					}, 350);
				});
				return;
			}
		}

		transitioning = false;
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

	function handleTap() {
		if (zoomed || justExitedZoom) return;
		handleTogglePlay();
		showOverlay = true;
		scheduleOverlayHide();
	}

	function handleZoomExit() {
		zoomed = false;
		// Show the overlay briefly on zoom exit so the user regains orientation
		showOverlay = true;
		scheduleOverlayHide();
		// Suppress the tap-to-play action for a short window after zoom exit so
		// the touch that triggered the exit doesn't immediately toggle play.
		justExitedZoom = true;
		setTimeout(() => { justExitedZoom = false; }, 350);
	}

	// Swipe handling
	function onTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1 || transitioning || zoomed) return;
		swipeStartX = e.touches[0].clientX;
		slideOffsetPx = 0;
		swiping = true;
	}

	function onTouchMove(e: TouchEvent) {
		if (!swiping || e.touches.length !== 1) return;
		let dx = e.touches[0].clientX - swipeStartX;
		if (dx > 0 && !hasPrev) { dx *= 0.2; }
		if (dx < 0 && !hasNext) { dx *= 0.2; }
		slideOffsetPx = dx;
	}

	async function onTouchEnd() {
		if (!swiping) return;
		swiping = false;
		const dx = slideOffsetPx;

		// Negligible movement — treat as tap, not swipe
		if (Math.abs(dx) < 2) {
			slideOffsetPx = 0;
			return;
		}

		const threshold = window.innerWidth * 0.2;
		if (Math.abs(dx) > threshold) {
			const dir = dx < 0 ? 1 : -1;
			const next = currentIndex + dir;
			if (next >= 0 && next < items.length) {
				transitioning = true;
				transitionHandled = false;
				// Commit current swipe position without transition, then animate to target
				slideAnimated = false;
				await tick();
				if (slidesContainer) void slidesContainer.offsetHeight;
				slideEasing = 'ease-out';
				slideAnimated = true;
				slideOffsetPx = dir === 1 ? -window.innerWidth : window.innerWidth;

				if (safetyTimer) clearTimeout(safetyTimer);
				safetyTimer = setTimeout(() => {
					safetyTimer = null;
					if (transitioning && slideOffsetPx !== 0) {
						transitionHandled = true;
						finishSlide();
					}
				}, 350);
				return;
			}
		}

		// Snap back to center
		transitioning = true;
		transitionHandled = false;
		slideAnimated = false;
		await tick();
		if (slidesContainer) void slidesContainer.offsetHeight;
		slideEasing = 'ease-out';
		slideAnimated = true;
		slideOffsetPx = 0;
		// transitionend handles cleanup (slideOffsetPx === 0 path)
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
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 overflow-hidden bg-black"
	onclick={handleTap}
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
		<!-- Slides: each absolutely positioned, keyed by item id.
		     When currentIndex changes, persisting slides keep their DOM elements
		     (no img src change) — only their translateX recalculates to the same
		     visual position. Off-screen items are added/removed invisibly. -->
		<div bind:this={slidesContainer} class="relative h-full w-full">
			{#each visibleSlides as vi (vi.item.id)}
				<div
					class="absolute inset-0"
					class:slide-animated={slideAnimated && !swiping}
					style="transform: translateX(calc({(vi.index - currentIndex) * 100}% + {slideOffsetPx}px)); --easing: {slideEasing}"
					ontransitionend={onSlideTransitionEnd}
				>
					<img
						src={imageVariantUrl(vi.item.id, variant)}
						alt={vi.item.title}
						class="slide-img"
					/>
				</div>
			{/each}

			<!-- SlideshowImage overlay: provides DZI deep-zoom, only mounted when at rest.
			     The plain img underneath is identical, so mount/unmount is seamless. -->
			{#if !transitioning && !swiping}
				<div class="absolute inset-0 z-10">
					<SlideshowImage
						item={currentItem}
						active={true}
						{zoomed}
						onZoom={() => zoomed = true}
						onZoomExit={handleZoomExit}
					/>
				</div>
			{/if}
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
				{hasPrev}
				{hasNext}
				onPrev={handlePrev}
				onNext={handleNext}
				onBack={handleBack}
			/>
		{/if}
	{/if}
</div>

<style>
	.slide-animated {
		transition: transform 250ms var(--easing, ease-out);
	}

	.slide-img {
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

<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { get } from 'svelte/store';
	import { imageVariantUrl } from '$lib/api/media';
	import { listPhotos, photoStats } from '$lib/api/collections';
	import { slideshowStore } from '$lib/stores/slideshow';
	import { navigationStore } from '$lib/stores/navigation';
	import { goBack } from '$lib/utils/breadcrumb.svelte';
	import { selectVariant } from '$lib/utils/variant';
	import type { PhotoItem } from '$lib/types';
	import SlideshowImage from './SlideshowImage.svelte';
	import SlideshowOverlay from './SlideshowOverlay.svelte';
	import PlayPauseFeedback from './PlayPauseFeedback.svelte';

	interface Props {
		collectionId?: number;
		externalItems?: PhotoItem[];
		autoplay: boolean;
		order: 'asc' | 'desc';
		recursive: boolean;
		startOrdinal?: number | null;
		collectionName?: string;
		showCounter?: boolean;
		onOrdinalChange?: (ordinal: number) => void;
		onClose?: () => void;
	}

	let {
		collectionId,
		externalItems,
		autoplay,
		order,
		recursive,
		startOrdinal = null,
		collectionName = '',
		showCounter = true,
		onOrdinalChange,
		onClose
	}: Props = $props();

	// Read from store on mount (skipped when items are provided externally)
	const store = externalItems == null ? get(slideshowStore) : null;
	// svelte-ignore state_referenced_locally -- intentional initial-value fork; these don't change after mount
	let items = $state<PhotoItem[]>(externalItems ?? store?.items ?? []);
	// svelte-ignore state_referenced_locally
	let total = $state(externalItems != null ? externalItems.length : (store?.total ?? 0));
	// svelte-ignore state_referenced_locally -- intentional: order/recursive are props used only as initial defaults
	const storeParams = store?.params ?? { sortOrder: order === 'desc' ? 'desc' : 'asc', recursive };

	// Find start position by ordinal in pre-loaded store items (in-app navigation).
	// For fresh loads items will be empty; loadInitial() sets currentIndex after fetching.
	// svelte-ignore state_referenced_locally
	const startIndex = startOrdinal != null ? items.findIndex((i) => i.ordinal === startOrdinal) : -1;
	// svelte-ignore state_referenced_locally
	let currentIndex = $state(startIndex >= 0 ? startIndex : 0);

	// svelte-ignore state_referenced_locally
	let playing = $state(autoplay);
	let showOverlay = $state(false);

	// Slide transition state
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
	let swipeStartY = 0;
	let swiping = $state(false);
	// null until first significant movement decides which axis the gesture follows.
	// Horizontal => paginate prev/next. Vertical (downward only) => dismiss to parent.
	let swipeAxis = $state<'horizontal' | 'vertical' | null>(null);
	const AXIS_LOCK_PX = 8;

	// Pinch state (centralized here so the touch target — this root div — never
	// gets unmounted mid-gesture). Double-tap detection lives in handleTap and
	// piggybacks on the browser's click events (which fire for both mouse and
	// touch), so it doesn't need its own touch-level state.
	let initialPinchDist = 0;
	let pinchActive = false;

	// Dismiss-gesture state (vertical drag-down to go up a level)
	let dismissOffsetY = $state(0);
	let dismissOriginY = $state(0); // CSS transform-origin Y so photo shrinks toward the touch point
	let dismissAnimated = $state(false);
	let dismissCommitted = $state(false); // once committed, animation plays out and then we navigate

	// Long-edge of the viewport that dismissOffsetY animates toward when committing.
	// Cached at gesture start so we don't read window during reactive derivations.
	let viewportH = $state(typeof window === 'undefined' ? 1 : window.innerHeight);

	const dismissProgress = $derived(
		viewportH > 0 ? Math.min(1, Math.max(0, dismissOffsetY) / viewportH) : 0
	);
	// Photo shrinks to 60% at full drag — matches iPhone Photos feel.
	const dismissScale = $derived(1 - dismissProgress * 0.4);
	// Black backdrop fully fades by ~half-screen drag, revealing the parent view.
	const bgOpacity = $derived(
		swipeAxis === 'vertical' || dismissCommitted
			? Math.max(0, 1 - dismissProgress * 2)
			: 1
	);

	let zoomed = $state(false);
	let justExitedZoom = $state(false);
	let initialZoomScale = $state(1);

	// Entering zoom always pauses autoplay so the photo doesn't slide out from
	// under the user.
	$effect(() => {
		if (zoomed) playing = false;
	});
	let overlayHideTimer: ReturnType<typeof setTimeout> | null = null;
	let playTimer: ReturnType<typeof setInterval> | null = null;
	// Deferred-tap timer: the first click of a double-click/double-tap is held
	// briefly so a second click within the window can cancel it and enter zoom
	// instead. Without this, the first tap of a double-tap would toggle play.
	let pendingTapTimer: ReturnType<typeof setTimeout> | null = null;
	const DOUBLE_TAP_MS = 200;

	// Play/pause feedback: a brief centered icon flash on toggle.
	// feedbackKey increments on each toggle so the element re-mounts and replays the animation.
	let feedbackPlaying = $state(false);
	let feedbackKey = $state(0);

	const currentItem = $derived(items[currentIndex] ?? null);
	const currentOrdinal = $derived(items[currentIndex]?.ordinal ?? 0);

	// Update the URL as the user navigates between photos (replaceState, no new history entry).
	$effect(() => {
		const item = currentItem;
		if (item) onOrdinalChange?.(item.ordinal);
	});
	const hasPrev = $derived(currentOrdinal > 0 || currentIndex > 0);
	const hasNext = $derived(
		total > 0 ? currentOrdinal < total - 1 : currentIndex < items.length - 1
	);

	const variant = $derived(selectVariant(window.innerWidth, window.innerHeight));

	// Visible slides: current item ± 1, keyed by item id so DOM elements persist
	// across index changes — no img src swaps, no flicker.
	const visibleSlides = $derived.by(() => {
		const result: Array<{ index: number; item: PhotoItem }> = [];
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
		if (externalItems != null) return;
		if (items.length === 0) {
			await loadInitial();
		}
		if (total === 0) {
			const stats = await photoStats(collectionId!, storeParams.recursive);
			total = stats.total;
		}
	});

	onDestroy(() => {
		if (playTimer) clearInterval(playTimer);
		if (overlayHideTimer) clearTimeout(overlayHideTimer);
		if (safetyTimer) clearTimeout(safetyTimer);
		if (pendingTapTimer) clearTimeout(pendingTapTimer);
	});

	async function loadInitial() {
		// Fetch starting near the requested ordinal so it lands in the first page.
		const startOffset = startOrdinal != null ? Math.max(0, startOrdinal - 10) : 0;
		const page = await listPhotos(collectionId, {
			sortOrder: storeParams.sortOrder,
			recursive: storeParams.recursive,
			offset: startOffset,
			limit: 200
		});
		items = page.items;
		// Find start item if provided
		if (startOrdinal != null) {
			const idx = items.findIndex((i) => i.ordinal === startOrdinal);
			if (idx >= 0) currentIndex = idx;
		}
		// Update store total from first page if unknown
		if (total === 0 && page.items.length > 0) {
			total = page.items.length; // minimum known
		}
	}

	async function loadMore(direction: 'forward' | 'backward') {
		if (externalItems != null) return;
		if (direction === 'forward') {
			const lastOrdinal = items.at(-1)?.ordinal ?? -1;
			if (total > 0 && lastOrdinal >= total - 1) return;
			const page = await listPhotos(collectionId, {
				...storeParams,
				offset: lastOrdinal + 1,
				limit: 200
			});
			// Re-read lastOrdinal after the await — concurrent loads may have grown items.
			// Only append items strictly after the current last ordinal, sorted ascending.
			const boundary = items.at(-1)?.ordinal ?? -1;
			const newItems = page.items
				.filter((i) => i.ordinal > boundary)
				.sort((a, b) => a.ordinal - b.ordinal);
			if (newItems.length > 0) {
				items = [...items, ...newItems];
				slideshowStore.appendItems(newItems);
			}
		} else {
			const firstOrdinal = items[0]?.ordinal ?? 0;
			if (firstOrdinal === 0) return;
			const newOffset = Math.max(0, firstOrdinal - 200);
			const page = await listPhotos(collectionId, {
				...storeParams,
				offset: newOffset,
				limit: 200
			});
			// Re-read firstOrdinal after the await — concurrent loads may have grown items.
			// Only prepend items strictly before the current first ordinal, sorted ascending.
			const boundary = items[0]?.ordinal ?? 0;
			const newItems = page.items
				.filter((i) => i.ordinal < boundary)
				.sort((a, b) => a.ordinal - b.ordinal);
			if (newItems.length > 0) {
				items = [...newItems, ...items];
				currentIndex += newItems.length;
				slideshowStore.appendItems(newItems);
			}
		}
	}

	// Prefetch next page when nearing the end
	$effect(() => {
		if (currentItem && currentIndex >= items.length - 5) {
			loadMore('forward');
		}
	});

	// Prefetch previous page when nearing the start
	$effect(() => {
		if (currentIndex <= 4 && items[0]?.ordinal > 0) {
			loadMore('backward');
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
		if (safetyTimer) {
			clearTimeout(safetyTimer);
			safetyTimer = null;
		}

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

	function handlePrev() {
		advance(-1);
	}
	function handleNext() {
		advance(1);
	}
	function handleTogglePlay() {
		playing = !playing;
		feedbackPlaying = playing;
		feedbackKey += 1;
	}
	function handleBack() {
		if (onClose) {
			onClose();
		} else {
			goBack();
		}
	}

	// Consume Escape when DZI is active, or when an onClose handler is provided
	// (search overlay). Otherwise let the layout handler pop the breadcrumb.
	onMount(() =>
		navigationStore.pushEscapeHandler(() => {
			if (zoomed) {
				zoomed = false;
				return true;
			}
			if (onClose) {
				onClose();
				return true;
			}
			return false;
		})
	);

	function scheduleOverlayHide() {
		if (overlayHideTimer) clearTimeout(overlayHideTimer);
		overlayHideTimer = setTimeout(() => {
			showOverlay = false;
		}, 3000);
	}

	function handleInteraction() {
		showOverlay = true;
		scheduleOverlayHide();
	}

	function handleTap() {
		if (zoomed || justExitedZoom) return;
		// Second click within the double-tap window: cancel the deferred toggle
		// and treat the pair as a zoom request. Works uniformly for mouse
		// double-click and touch double-tap since both fire `click` events.
		if (pendingTapTimer !== null) {
			clearTimeout(pendingTapTimer);
			pendingTapTimer = null;
			initialZoomScale = 2;
			zoomed = true;
			return;
		}
		pendingTapTimer = setTimeout(() => {
			pendingTapTimer = null;
			if (zoomed || justExitedZoom) return;
			handleTogglePlay();
			showOverlay = true;
			scheduleOverlayHide();
		}, DOUBLE_TAP_MS);
	}

	function handleZoomExit() {
		zoomed = false;
		// Reset entry-zoom hint so the next zoom entry (which may come via a
		// non-double-tap path) starts at fit.
		initialZoomScale = 1;
		// Show the overlay briefly on zoom exit so the user regains orientation
		showOverlay = true;
		scheduleOverlayHide();
		// Suppress the tap-to-play action for a short window after zoom exit so
		// the touch that triggered the exit doesn't immediately toggle play.
		justExitedZoom = true;
		setTimeout(() => {
			justExitedZoom = false;
		}, 350);
	}

	// Swipe handling
	function onTouchStart(e: TouchEvent) {
		if (transitioning || dismissCommitted) return;

		// Two-finger touch: record baseline for pinch-out → zoom detection.
		// While zoomed, OSD owns the gesture and we stay out of the way.
		if (e.touches.length === 2) {
			if (zoomed) return;
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			initialPinchDist = Math.hypot(dx, dy);
			pinchActive = true;
			swiping = false;
			return;
		}

		if (e.touches.length !== 1 || zoomed) return;
		swipeStartX = e.touches[0].clientX;
		swipeStartY = e.touches[0].clientY;
		swipeAxis = null;
		slideOffsetPx = 0;
		dismissOffsetY = 0;
		dismissOriginY = swipeStartY;
		dismissAnimated = false;
		viewportH = window.innerHeight;
		swiping = true;
	}

	function onTouchMove(e: TouchEvent) {
		// Two-finger pinch-out → enter zoom. Once triggered, OSD takes over.
		if (e.touches.length === 2 && initialPinchDist > 0 && !zoomed) {
			e.preventDefault();
			const px = e.touches[0].clientX - e.touches[1].clientX;
			const py = e.touches[0].clientY - e.touches[1].clientY;
			const dist = Math.hypot(px, py);
			if (dist / initialPinchDist > 1.2) {
				initialPinchDist = 0;
				zoomed = true;
			}
			return;
		}

		if (!swiping || e.touches.length !== 1) return;
		const dx = e.touches[0].clientX - swipeStartX;
		const dy = e.touches[0].clientY - swipeStartY;

		// First-pass axis lock: whichever axis crosses the threshold first owns
		// the gesture. Upward drags (dy < 0) are ignored — we only dismiss on
		// downward motion. If horizontal wins, vertical is suppressed for this
		// gesture, and vice versa.
		if (swipeAxis === null) {
			if (Math.abs(dx) > AXIS_LOCK_PX && Math.abs(dx) >= Math.abs(dy)) {
				swipeAxis = 'horizontal';
			} else if (dy > AXIS_LOCK_PX && dy > Math.abs(dx)) {
				swipeAxis = 'vertical';
			} else {
				return;
			}
		}

		if (swipeAxis === 'vertical') {
			// Negative dy (finger moves back up past the start) clamps to 0 so
			// the photo doesn't get pushed off the top — feels like rubber-band.
			dismissOffsetY = Math.max(0, dy);
			return;
		}

		// Horizontal
		let adx = dx;
		if (adx > 0 && !hasPrev) adx *= 0.2;
		if (adx < 0 && !hasNext) adx *= 0.2;
		slideOffsetPx = adx;
	}

	async function onTouchEnd(e: TouchEvent) {
		// Reset pinch tracking once all fingers are lifted. Double-tap is
		// detected via the synthesized click events (see handleTap), not here.
		if (e.touches.length === 0) {
			initialPinchDist = 0;
			pinchActive = false;
		}

		if (!swiping) return;
		const axis = swipeAxis;
		swiping = false;
		swipeAxis = null;

		if (axis === 'vertical') {
			await finishDismissGesture();
			return;
		}

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

	// Dismiss-gesture release: either commit (navigate up a level) or snap back.
	async function finishDismissGesture() {
		const dy = dismissOffsetY;
		// Commit when finger has crossed ~15% of viewport height — same feel as
		// horizontal pagination's 20% threshold but a bit easier since dismissal
		// is the destructive direction.
		const threshold = viewportH * 0.15;
		if (dy > threshold) {
			dismissCommitted = true;
			dismissAnimated = true;
			// Animate the rest of the way down, then navigate. By the time
			// handleBack() fires, bgOpacity is already 0 so the parent view
			// is fully visible underneath.
			dismissOffsetY = viewportH;
			window.setTimeout(() => {
				handleBack();
			}, 220);
			return;
		}
		// Snap back to identity transform
		dismissAnimated = true;
		dismissOffsetY = 0;
		window.setTimeout(() => {
			dismissAnimated = false;
		}, 220);
	}

	// Desktop scroll-wheel up → enter zoom. Once zoomed, OSD owns the wheel.
	function onWheel(e: WheelEvent) {
		if (zoomed) return;
		if (e.deltaY < 0) {
			e.preventDefault();
			zoomed = true;
		}
	}

	// Keyboard navigation
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			handleInteraction();
			advance(-1);
		} else if (e.key === 'ArrowRight') {
			handleInteraction();
			advance(1);
		} else if (e.key === ' ') {
			e.preventDefault();
			handleInteraction();
			handleTogglePlay();
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 touch-none overflow-hidden"
	onclick={handleTap}
	onwheel={onWheel}
	onmousemove={handleInteraction}
	ontouchstart={onTouchStart}
	ontouchmove={onTouchMove}
	ontouchend={onTouchEnd}
	role="presentation"
>
	<!-- Black backdrop sits behind everything. Fades out during dismiss so the
	     parent view (rendered behind this fixed overlay) shows through. -->
	<div
		class="absolute inset-0 bg-black"
		class:dismiss-animated={dismissAnimated}
		style="opacity: {bgOpacity}"
	></div>

	<!-- Inner content wrapper handles the dismiss transform. transform-origin
	     follows the touch start point so the photo shrinks toward the finger.
	     overflow-hidden clips the prev/next slides at the wrapper edge so they
	     don't pull into view as the wrapper scales down during dismissal. -->
	<div
		class="absolute inset-0 overflow-hidden"
		class:dismiss-animated={dismissAnimated}
		style="transform: translate3d(0, {dismissOffsetY}px, 0) scale({dismissScale}); transform-origin: 50% {dismissOriginY}px;"
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

			<!-- SlideshowImage overlay: provides DZI deep-zoom. Stays mounted at all
			     times so the gesture target on the parent is never destroyed mid-
			     touch.
			     - pointer-events-none while not zoomed: gestures pass through to
			       the parent's handlers. Toggles to auto when zoomed so OSD owns
			       the canvas.
			     - invisible during swipe/transition: visibleSlides beneath show
			       the motion instead. The underlying <img> is identical, so the
			       hide/show flip is visually seamless. -->
			<div
				class="absolute inset-0 z-10"
				class:pointer-events-none={!zoomed}
				class:invisible={(swiping || transitioning) && !zoomed}
			>
				<SlideshowImage
					item={currentItem}
					active={true}
					{zoomed}
					{initialZoomScale}
					onZoomExit={handleZoomExit}
				/>
			</div>
		</div>

		<!-- Play/pause feedback flash -->
		<PlayPauseFeedback playing={feedbackPlaying} {feedbackKey} />

		{#if showOverlay && !zoomed && swipeAxis !== 'vertical' && !dismissCommitted}
			<SlideshowOverlay
				item={currentItem}
				collectionName={currentItem.collection_name ?? collectionName}
				{total}
				{hasPrev}
				{hasNext}
				{showCounter}
				onPrev={handlePrev}
				onNext={handleNext}
				onBack={handleBack}
			/>
		{/if}
	{/if}
	</div>
</div>

<style>
	.slide-animated {
		transition: transform 250ms var(--easing, ease-out);
	}

	.dismiss-animated {
		transition:
			transform 220ms ease-out,
			opacity 220ms ease-out;
	}

	.slide-img {
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		object-fit: contain;
	}

</style>

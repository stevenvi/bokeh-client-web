<script lang="ts">
	import type { PhotoItem } from '$lib/types';
	import { imageVariantUrl, dziManifestUrl } from '$lib/api/media';
	import { selectVariant } from '$lib/utils/variant';
	import OpenSeadragon from 'openseadragon';

	interface Props {
		item: PhotoItem;
		active: boolean;
		zoomed?: boolean;
		onZoom?: () => void;
		onZoomExit?: () => void;
	}

	const maxZoomLevel = 2;

	let { item, active, zoomed = false, onZoom, onZoomExit }: Props = $props();

	// Track which item id has fired onload so we can remember it without an effect.
	// Using $derived.by (part of the reactive graph) ensures fullLoaded is always
	// correct before any DOM update — no effect scheduling lag.
	let loadedId = $state<number | null>(null);
	const fullLoaded = $derived.by(() => {
		if (loadedId === item.id) return true;
		// Check if the browser already has this image decoded in cache.
		const checkImg = new Image();
		checkImg.src = imageVariantUrl(item.id, variant);
		return checkImg.complete && checkImg.naturalWidth > 0;
	});

	// Show the thumb as a stand-in while the full image loads, but only if the
	// browser already has it in memory (it should from the grid view). If it's
	// not cached, we skip it rather than triggering an extra fetch.
	const thumbCached = $derived.by(() => {
		if (fullLoaded) return false;
		const check = new Image();
		check.src = imageVariantUrl(item.id, 'thumb');
		return check.complete && check.naturalWidth > 0;
	});

	let showDzi = $state(false);
	let dziLoading = $state(false);
	let hideBackdrop = $state(false);
	let dziFadingOut = $state(false);
	let dziContainer: HTMLDivElement | null = $state(null);
	let viewer: OpenSeadragon.Viewer | null = null;
	let exitTimer: ReturnType<typeof setTimeout> | null = null;

	const variant = $derived(selectVariant(window.innerWidth, window.innerHeight));
	const fullSrc = $derived(imageVariantUrl(item.id, variant));

	// Reset DZI/visual state when item changes
	$effect(() => {
		item; // track
		showDzi = false;
		dziLoading = false;
		hideBackdrop = false;
		dziFadingOut = false;
		if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; }
		if (viewer) {
			viewer.destroy();
			viewer = null;
		}
	});

	// Parent can request exit zoom via the zoomed prop
	$effect(() => {
		if (!zoomed && showDzi) {
			exitDzi();
		}
	});

	function onFullLoad() {
		loadedId = item.id;
	}

	function initDzi() {
		if (!dziContainer || showDzi) return;
		showDzi = true;
		dziLoading = true;
		onZoom?.();
		requestAnimationFrame(() => {
			if (!dziContainer) return;
			// Timestamp viewer construction so we can suppress auto-exit during the
			// initial entry animation (see animation-finish handler below).
			const initTime = performance.now();
			// Seed OSD with the preview image so the user can zoom immediately while
			// the high-res DZI manifest loads in the background.
			viewer = OpenSeadragon({
				element: dziContainer,
				tileSources: { type: 'image', url: imageVariantUrl(item.id, variant) },
				showNavigationControl: false,
				ajaxWithCredentials: true,
				// Constrain viewport: can't zoom out past "fit", can't drag image off-screen.
				minZoomImageRatio: 1,
				visibilityRatio: 1,
				constrainDuringPan: true,
				// Snappier animations (defaults: animationTime=1.2, springStiffness=6.5)
				animationTime: 0.6,
				springStiffness: 10,
				zoomPerScroll: 1.25,
				gestureSettingsMouse: { clickToZoom: false },
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				gestureSettingsTouch: { dblTapToZoom: false, pinchToZoom: true } as any
			});

			// Preview image opened — begin loading DZI tiles on top. Register the
			// world 'add-item' listener first so we can't miss it, then call
			// addTiledImage. Because 'open' fires after the preview is already in
			// the world, the first 'add-item' we see here is always the DZI.
			viewer.addHandler('open', () => {
				if (!viewer) return;
				// Lock max zoom to (maxZoomLevel)x the preview's native pixel resolution NOW,
				// while contentSize still reflects only the preview. Once
				// maxZoomLevel is set, OSD uses it directly and ignores the
				// contentSize-based calculation — so adding the much-larger DZI
				// tiled image below won't expand the zoom limit.
				// (maxZoomLevel exists at runtime but is missing from OSD's TS types.)
				// @ts-expect-error - maxZoomLevel is a real OSD Viewport property
				viewer.viewport.maxZoomLevel = viewer.viewport.imageToViewportZoom(maxZoomLevel);
				viewer.world.addHandler('add-item', () => {
					// DZI manifest is fetched and the item is in the world —
					// tiles are now loading; spinner can go.
					dziLoading = false;
				});
				viewer.addTiledImage({
					tileSource: dziManifestUrl(item.id),
					x: 0,
					y: 0,
					width: 1,
					ajaxWithCredentials: true
				});
			});

			// First tile drawn (preview from cache — very fast) means OSD canvas is
			// painting; fade out the <img> backdrop so only the OSD canvas shows.
			let firstTileDrawn = false;
			viewer.addHandler('tile-drawn', () => {
				if (firstTileDrawn) return;
				firstTileDrawn = true;
				hideBackdrop = true;
			});

			// Auto-exit DZI when the user zooms all the way back to the home (fit) level.
			// Use 'zoom' to track whether the user has zoomed in, and 'animation-finish'
			// to check the final resting zoom after easing completes.
			//
			// The arming threshold must be high enough that a single small wheel-tick or
			// the tail of the entry-spring doesn't satisfy it — otherwise the spring
			// settles back near home, animation-finish fires, and we accidentally exit
			// during what the user intended as zoom-in. Require the user to zoom 25%
			// past fit before auto-exit can fire.
			const AUTO_EXIT_ARM_THRESHOLD = 1.25;
			// Additional grace period after viewer construction during which auto-exit
			// is fully disabled. Protects against the entry animation itself triggering.
			const AUTO_EXIT_GRACE_MS = 350;
			let hasZoomedIn = false;
			// When the user zooms back to home, we first animate the viewport to
			// perfect centered-fit (via OSD's own spring) and only fade out once
			// that re-center animation finishes. This flag distinguishes the two
			// animation-finish events.
			let homingForExit = false;
			viewer.addHandler('zoom', (e: { zoom: number }) => {
				if (!viewer) return;
				const minZoom = viewer.viewport.getMinZoom();
				if (e.zoom > minZoom * AUTO_EXIT_ARM_THRESHOLD) {
					hasZoomedIn = true;
				}
			});
			viewer.addHandler('animation-finish', () => {
				if (!viewer) return;
				if (performance.now() - initTime < AUTO_EXIT_GRACE_MS) return;
				// Second animation-finish: the recenter-home animation just ended.
				// Confirm we're still at home (user didn't re-engage), then fade out.
				if (homingForExit) {
					homingForExit = false;
					const zoom = viewer.viewport.getZoom();
					const minZoom = viewer.viewport.getMinZoom();
					if (zoom <= minZoom * 1.01) {
						hasZoomedIn = false;
						exitDzi();
					}
					return;
				}
				if (!hasZoomedIn) return;
				const zoom = viewer.viewport.getZoom();
				const minZoom = viewer.viewport.getMinZoom();
				if (zoom <= minZoom * 1.01) {
					// Smoothly animate to perfect centered-fit so the OSD canvas
					// matches the centered preview underneath before the fade.
					// If we're already centered, skip the wait and exit now.
					const home = viewer.viewport.getHomeBounds().getCenter();
					const current = viewer.viewport.getCenter();
					const dx = current.x - home.x;
					const dy = current.y - home.y;
					if (dx * dx + dy * dy < 1e-6) {
						hasZoomedIn = false;
						exitDzi();
					} else {
						homingForExit = true;
						viewer.viewport.goHome(false);
					}
				}
			});
		});
	}

	function handleDoubleClick() {
		initDzi();
	}

	function handleWheel(e: WheelEvent) {
		// Ctrl+scroll or plain scroll wheel triggers DZI zoom on desktop
		if (!showDzi && (e.ctrlKey || Math.abs(e.deltaY) > 0)) {
			if (e.deltaY < 0) {
				// Zoom in
				e.preventDefault();
				initDzi();
			}
		}
	}

	function exitDzi() {
		if (dziFadingOut) return;
		// Notify parent so it can reset zoomed state
		onZoomExit?.();
		// Immediately show the backdrop image underneath and dismiss any lingering spinner
		hideBackdrop = false;
		dziLoading = false;
		// After 50ms, start fading out the DZI overlay
		dziFadingOut = true;
		exitTimer = setTimeout(() => {
			// After the 250ms fade completes, tear down the viewer
			exitTimer = setTimeout(() => {
				if (viewer) {
					viewer.destroy();
					viewer = null;
				}
				showDzi = false;
				dziFadingOut = false;
			}, 250);
		}, 50);
	}

	// Touch gesture detection (pinch to enter zoom, double-tap to enter/exit zoom)
	let touches: Touch[] = [];
	let initialPinchDist = 0;
	let lastTapTime = 0;
	let lastTapX = 0;
	let lastTapY = 0;

	function onTouchStart(e: TouchEvent) {
		touches = Array.from(e.touches);
		if (touches.length === 2) {
			const dx = touches[0].clientX - touches[1].clientX;
			const dy = touches[0].clientY - touches[1].clientY;
			initialPinchDist = Math.hypot(dx, dy);
		}
	}

	function onTouchMove(e: TouchEvent) {
		if (e.touches.length === 2) {
			// Prevent browser native pinch-to-zoom from hijacking the gesture.
			e.preventDefault();
			if (initialPinchDist > 0 && !showDzi) {
				const dx = e.touches[0].clientX - e.touches[1].clientX;
				const dy = e.touches[0].clientY - e.touches[1].clientY;
				const dist = Math.hypot(dx, dy);
				if (dist / initialPinchDist > 1.2) {
					initDzi();
				}
			}
		}
	}

	function onTouchEnd(e: TouchEvent) {
		// Only act on single-finger lifts that end all touches
		if (e.changedTouches.length !== 1 || e.touches.length !== 0) return;
		const touch = e.changedTouches[0];
		const now = Date.now();
		const dist = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY);
		if (now - lastTapTime < 300 && dist < 50) {
			// Double tap: enter zoom if not showing, exit if showing
			if (showDzi) {
				exitDzi();
			} else {
				initDzi();
			}
			lastTapTime = 0; // reset so triple-tap doesn't re-trigger
		} else {
			lastTapTime = now;
			lastTapX = touch.clientX;
			lastTapY = touch.clientY;
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative h-full w-full touch-none"
	ondblclick={handleDoubleClick}
	onwheel={handleWheel}
	ontouchstart={onTouchStart}
	ontouchmove={onTouchMove}
	ontouchend={onTouchEnd}
	role="presentation"
>
	<!-- Thumb stand-in: shown while full image loads, only if already in browser cache -->
	{#if thumbCached}
		<img
			src={imageVariantUrl(item.id, 'thumb')}
			alt=""
			class="absolute inset-0 h-full w-full object-contain"
			aria-hidden="true"
		/>
	{/if}

	<!-- Full-res image — scaled to fill viewport while preserving aspect ratio -->
	<img
		src={fullSrc}
		alt={item.title}
		class="slideshow-img absolute inset-0"
		class:transition-opacity={!dziFadingOut}
		class:duration-500={!dziFadingOut}
		class:opacity-0={!fullLoaded || hideBackdrop}
		class:pointer-events-none={showDzi}
		onload={onFullLoad}
	/>

	<!-- OpenSeadragon container — transparent until tiles render over the <img> -->
	<div
		bind:this={dziContainer}
		class="absolute inset-0"
		class:hidden={!showDzi}
		class:dzi-fade-out={dziFadingOut}
	></div>

	<!-- Loading spinner while manifest/tiles are fetching -->
	{#if dziLoading}
		<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
			<div class="dzi-spinner"></div>
		</div>
	{/if}

	<!-- Exit zoom button -->
	{#if showDzi}
		<button
			class="bg-surface/80 absolute right-4 top-4 z-10 rounded-lg px-3 py-1.5 text-xs text-white"
			onclick={exitDzi}
		>
			Exit Zoom
		</button>
	{/if}
</div>

<style>
	/* Override Tailwind Preflight's max-width:100% / height:auto on <img>
	   so that images smaller than the viewport scale up to fill it. */
	.slideshow-img {
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		object-fit: contain;
	}

	.dzi-fade-out {
		opacity: 0;
		transition: opacity 250ms ease-out;
	}

	.dzi-spinner {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 3px solid rgba(255, 255, 255, 0.25);
		border-top-color: rgba(255, 255, 255, 0.85);
		animation: dzi-spin 0.75s linear infinite;
		/* Subtle shadow so it's visible on both dark and light images */
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
	}

	@keyframes dzi-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

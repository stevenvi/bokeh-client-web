<script lang="ts">
	import type { SlideshowItem } from '$lib/types';
	import { imageVariantUrl, dziManifestUrl } from '$lib/api/media';
	import { selectVariant } from '$lib/utils/variant';
	import OpenSeadragon from 'openseadragon';

	interface Props {
		item: SlideshowItem;
		active: boolean;
		zoomed?: boolean;
		onZoom?: () => void;
		onZoomExit?: () => void;
	}

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

	let showDzi = $state(false);
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

	// Fade out backdrop image a few seconds after DZI activates
	let backdropTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		if (showDzi) {
			backdropTimer = setTimeout(() => { hideBackdrop = true; }, 250);
		} else {
			if (backdropTimer) clearTimeout(backdropTimer);
		}
	});

	function onFullLoad() {
		loadedId = item.id;
	}

	function initDzi() {
		if (!dziContainer || showDzi) return;
		showDzi = true;
		onZoom?.();
		requestAnimationFrame(() => {
			if (!dziContainer) return;
			viewer = OpenSeadragon({
				element: dziContainer,
				tileSources: dziManifestUrl(item.id),
				showNavigationControl: false,
				ajaxWithCredentials: true,
				// Constrain viewport: can't zoom out past "fit", can't drag image off-screen.
				minZoomImageRatio: 1,
				visibilityRatio: 1,
				constrainDuringPan: true,
				// Snappier animations (defaults: animationTime=1.2, springStiffness=6.5)
				animationTime: 0.6,
				springStiffness: 10,
				zoomPerScroll: 1.3,
				// Allow zooming to 4x native resolution
				maxZoomPixelRatio: 4,
				gestureSettingsMouse: { clickToZoom: false },
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				gestureSettingsTouch: { dblTapToZoom: true, pinchToZoom: true } as any
			});

			// Auto-exit DZI when the user zooms all the way back to the home (fit) level.
			// Use 'zoom' to track whether the user has zoomed in, and 'animation-finish'
			// to check the final resting zoom after easing completes.
			let hasZoomedIn = false;
			viewer.addHandler('zoom', (e: { zoom: number }) => {
				if (!viewer) return;
				const minZoom = viewer.viewport.getMinZoom();
				if (e.zoom > minZoom * 1.05) {
					hasZoomedIn = true;
				}
			});
			viewer.addHandler('animation-finish', () => {
				if (!viewer || !hasZoomedIn) return;
				const zoom = viewer.viewport.getZoom();
				const minZoom = viewer.viewport.getMinZoom();
				if (zoom <= minZoom * 1.01) {
					hasZoomedIn = false;
					exitDzi();
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
		// Immediately show the backdrop image underneath
		hideBackdrop = false;
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

	// Touch pinch detection
	let touches: Touch[] = [];
	let initialPinchDist = 0;

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
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative h-full w-full touch-none"
	ondblclick={handleDoubleClick}
	onwheel={handleWheel}
	ontouchstart={onTouchStart}
	ontouchmove={onTouchMove}
	role="presentation"
>
	<!-- Placeholder blur -->
	{#if item.placeholder && !fullLoaded}
		<img
			src="data:image/webp;base64,{item.placeholder}"
			alt=""
			class="absolute inset-0 h-full w-full object-contain blur-sm scale-105 transition-opacity duration-300"
			class:opacity-0={fullLoaded}
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
</style>

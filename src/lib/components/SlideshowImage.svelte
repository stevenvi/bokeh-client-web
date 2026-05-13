<script lang="ts">
	import type { PhotoItem } from '$lib/types';
	import { imageVariantUrl, dziManifestUrl } from '$lib/api/media';
	import { selectVariant } from '$lib/utils/variant';
	import OpenSeadragon from 'openseadragon';
	import { onDestroy } from 'svelte';
	import LoadingIndicator from './LoadingIndicator.svelte';

	// OSD's ImageLoader.clear() only aborts queued (unstarted) jobs; in-flight
	// jobs aren't even tracked as objects (jobsInProgress is a counter). So we
	// wrap OpenSeadragon.ImageJob once to maintain our own Set of live jobs.
	// On teardown we iterate the Set and call job.abort() — which routes to the
	// tile source's downloadTileAbort and ultimately xhr.abort().
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const inflightImageJobs = new Set<any>();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const OrigImageJob = (OpenSeadragon as any).ImageJob;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function TrackingImageJob(this: any, options: any) {
		OrigImageJob.call(this, options);
		inflightImageJobs.add(this);
		const origCallback = this.callback;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.callback = (job: any) => {
			inflightImageJobs.delete(job);
			if (origCallback) origCallback(job);
		};
	}
	TrackingImageJob.prototype = OrigImageJob.prototype;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(OpenSeadragon as any).ImageJob = TrackingImageJob;

	function abortAllInflightTiles() {
		for (const job of inflightImageJobs) {
			if (typeof job.abort === 'function') {
				try {
					job.abort();
				} catch {
					// ignore — best-effort cleanup
				}
			}
		}
		inflightImageJobs.clear();
	}

	// Stop the viewer from issuing any further tile requests AND drop everything
	// already in flight. Needed before goHome (which sweeps zoom levels and would
	// otherwise enqueue tile loads we'll never use) and on full teardown.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function shutdownTileLoading(v: any) {
		const loader = v.imageLoader;
		// 1. Block new jobs. OSD's drawer keeps calling addJob during the
		//    goHome animation as the viewport sweeps zoom levels.
		loader.addJob = () => {};
		// 2. Drain queued (unstarted) jobs. clear() iterates jobQueue, calls
		//    each job.abort(), and empties the queue — without this, queued
		//    jobs would still start as jobsInProgress drops.
		loader.clear();
		// 3. Abort in-flight jobs (their XHRs). OSD doesn't track these as
		//    objects; our wrapped ImageJob constructor does.
		abortAllInflightTiles();
	}

	interface Props {
		item: PhotoItem;
		active: boolean;
		zoomed?: boolean;
		// Multiple of fit zoom that OSD should animate to on entry. 1 = fit
		// (default; used for pinch/wheel where the user's gesture already
		// provides motion). >1 gives an explicit zoom-in animation.
		initialZoomScale?: number;
		onZoomExit?: () => void;
	}

	const maxZoomLevel = 2;

	let { item, active, zoomed = false, initialZoomScale = 1, onZoomExit }: Props = $props();

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
	let osdReady = $state(false);
	let dziLoading = $state(false);
	let exitingToHome = $state(false);
	let dziContainer: HTMLDivElement | null = $state(null);
	let viewer: OpenSeadragon.Viewer | null = null;

	const variant = $derived(selectVariant(window.innerWidth, window.innerHeight));
	const fullSrc = $derived(imageVariantUrl(item.id, variant));

	// Reset DZI/visual state when item changes
	$effect(() => {
		item; // track
		showDzi = false;
		osdReady = false;
		dziLoading = false;
		exitingToHome = false;
		if (viewer) {
			shutdownTileLoading(viewer);
			viewer.destroy();
			viewer = null;
		}
	});

	// Parent owns zoom state. Drive DZI lifecycle off the `zoomed` prop.
	$effect(() => {
		if (zoomed && !showDzi) {
			initDzi();
		} else if (!zoomed && showDzi) {
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
				loadTilesWithAjax: true,
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

			// OSD has rendered at least once: the canvas is now displaying the
			// image, so we can remove the <img> backdrop. We listen on multiple
			// events because 'tile-drawn' isn't reliably emitted for
			// type:'image' sources across OSD versions; 'update-viewport' fires
			// on every render and is a reliable backup. Whichever fires first
			// wins; the flag prevents repeat work.
			//
			// Tap-driven entries (initialZoomScale > 1) animate from fit to the
			// target zoom — but only AFTER the canvas has painted at least one
			// frame at fit. By waiting for the first render and deferring one
			// more frame, the animation is guaranteed to start visibly at fit.
			let osdHasRendered = false;
			const markOsdRendered = () => {
				if (osdHasRendered) return;
				osdHasRendered = true;
				osdReady = true;
				if (initialZoomScale > 1) {
					requestAnimationFrame(() => {
						if (!viewer) return;
						const target = viewer.viewport.getMinZoom() * initialZoomScale;
						viewer.viewport.zoomTo(target, undefined, false);
					});
				}
			};
			viewer.addHandler('tile-drawn', markOsdRendered);
			viewer.addHandler('update-viewport', markOsdRendered);

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
				if (!hasZoomedIn) return;
				const zoom = viewer.viewport.getZoom();
				const minZoom = viewer.viewport.getMinZoom();
				if (zoom <= minZoom * 1.01) {
					hasZoomedIn = false;
					// exitDzi handles re-centering to home before tearing down OSD.
					exitDzi();
				}
			});
		});
	}

	function isViewerAtHome(v: OpenSeadragon.Viewer): boolean {
		const minZoom = v.viewport.getMinZoom();
		const zoom = v.viewport.getZoom();
		const home = v.viewport.getHomeBounds().getCenter();
		const current = v.viewport.getCenter();
		const dx = current.x - home.x;
		const dy = current.y - home.y;
		return zoom <= minZoom * 1.01 && dx * dx + dy * dy < 1e-6;
	}

	function exitDzi() {
		if (exitingToHome || !showDzi) return;
		// Notify parent so it can reset zoomed state
		onZoomExit?.();

		// Stop and abort all tile loading BEFORE the goHome animation runs.
		// The animation sweeps zoom levels and would otherwise enqueue many
		// new tile fetches that we'll never use. The drawer keeps painting
		// whatever tiles are already in its cache.
		if (viewer) shutdownTileLoading(viewer);

		// If the viewer isn't at home (fit + centered), animate it there first.
		// The OSD canvas displays the same preview the <img> backdrop holds, so
		// once we're back at home the swap is visually a no-op.
		if (viewer && !isViewerAtHome(viewer)) {
			exitingToHome = true;
			const v = viewer;
			const onHome = () => {
				v.removeHandler('animation-finish', onHome);
				exitingToHome = false;
				if (v !== viewer) return; // viewer was destroyed (e.g. item changed)
				teardownDzi();
			};
			v.addHandler('animation-finish', onHome);
			v.viewport.goHome(false);
			return;
		}

		teardownDzi();
	}

	// Ensure the viewer is torn down when the component unmounts. Without this, OSD is
	// orphaned and its in-flight tile requests run to completion.
	onDestroy(() => {
		if (viewer) {
			shutdownTileLoading(viewer);
			viewer.destroy();
			viewer = null;
		}
	});

	function teardownDzi() {
		// Tear down OSD and unhide the <img> in one frame — no transitions.
		if (viewer) {
			viewer.destroy();
			viewer = null;
		}
		showDzi = false;
		osdReady = false;
		dziLoading = false;
	}

</script>

<div class="relative h-full w-full">
	<!-- Full-res image — scaled to fill viewport while preserving aspect ratio.
	     Stays in view during DZI entry until OSD has painted its first tile;
	     then removed from layout (display:none) so OSD's canvas is the only
	     thing visible. Single-frame swap, no flicker. -->
	<img
		src={fullSrc}
		alt={item.title}
		class="slideshow-img absolute inset-0"
		class:hidden={osdReady}
		class:opacity-0={!fullLoaded}
		onload={onFullLoad}
	/>

	<!-- OpenSeadragon container — visible while DZI is up. Black background only
	     once OSD is actually painting (osdReady), so during the brief construction
	     window the <img> below remains visible through the still-empty canvas.
	     Once painting, bg-black blocks any transparent canvas region from
	     exposing anything underneath. -->
	<div
		bind:this={dziContainer}
		class="absolute inset-0"
		class:bg-black={osdReady}
		class:hidden={!showDzi}
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

	<!-- Loading feedback. DZI takes priority over image preview since it's the
	     newer/more-explicit user action. The image-loading indicator waits a few
	     frames before appearing so it doesn't flicker into view while the user
	     is quickly scrolling between cached images. -->
	{#if dziLoading}
		<LoadingIndicator label="Loading zoom…" />
	{:else if !fullLoaded}
		<LoadingIndicator label="Loading image…" delayFrames={5} />
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

</style>

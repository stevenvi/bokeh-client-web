import type { ImageVariant } from '$lib/types';

/**
 * Select the appropriate image variant for the given viewport dimensions.
 * Accounts for device pixel ratio so retina/HiDPI screens get a higher-res variant.
 *
 * Variant thresholds (long edge in physical pixels):
 *   ≤ 400  → thumb  (400px)
 *   ≤ 1280 → small  (1280px)
 *   > 1280 → preview (1920px, max available)
 *
 * For viewports larger than 1920px, clients use `preview` and rely on
 * OpenSeadragon DZI tiles for true deep-zoom at full resolution.
 */
export function selectVariant(viewportWidth: number, viewportHeight: number): ImageVariant {
	const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1;
	const longest = Math.max(viewportWidth, viewportHeight) * dpr;

	if (longest <= 400) return 'thumb';
	if (longest <= 1280) return 'small';
	return 'preview';
}

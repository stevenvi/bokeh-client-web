<script lang="ts">
	import type { SlideshowItem } from '$lib/types';
	import type { MediaItemDetail } from '$lib/types';

	interface Props {
		item: SlideshowItem;
		detail: MediaItemDetail | null;
		collectionName: string;
		hasPrev: boolean;
		hasNext: boolean;
		onPrev: () => void;
		onNext: () => void;
		onBack: () => void;
	}

	let {
		item,
		detail,
		collectionName,
		hasPrev,
		hasNext,
		onPrev,
		onNext,
		onBack
	}: Props = $props();

	const meta = $derived(detail?.photo ?? null);

	function fmt(val: number | string | null, unit = ''): string {
		if (val == null) return '—';
		return `${val}${unit}`;
	}

	function fmtDate(s: string | null): string {
		if (!s) return '—';
		return new Date(s).toLocaleString();
	}

	function fmtAperture(v: number | null): string {
		if (v == null) return '—';
		return `ƒ/${v}`;
	}

	/** Returns an HTML string for shutter speed. Safe: value is always a parsed number. */
	function fmtShutter(s: string | null): string {
		if (s == null) return '—';
		const sec = parseFloat(s);
		if (!isFinite(sec) || sec <= 0) return '—';
		if (sec >= 1) {
			// Show to tenths, drop trailing .0
			const rounded = Math.round(sec * 10) / 10;
			const display = rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
			return `${display}&thinsp;s`;
		}
		// Sub-second: display as fraction with superscript numerator and subscript denominator
		const denom = Math.round(1 / sec);
		return `<sup>1</sup>&frasl;<sub>${denom}</sub>`;
	}
</script>

<!-- Desktop/tablet overlay -->
<div class="pointer-events-none absolute inset-0 z-10 hidden md:flex flex-col justify-between">
	<!-- Top bar -->
	<div class="pointer-events-auto flex items-center bg-gradient-to-b from-black/60 to-transparent px-4 py-3">
		<button
			class="text-white/80 hover:text-white mr-4 flex items-center gap-2 text-sm"
			onclick={onBack}
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
			</svg>
			Back
		</button>
		<span class="flex-1 text-center text-sm font-medium text-white/90">{collectionName}</span>
	</div>

	<!-- Center nav arrows -->
	<div class="pointer-events-auto flex items-center justify-between px-4">
		{#if hasPrev}
			<button
				class="bg-black/30 hover:bg-black/50 rounded-full p-3 text-white"
				onclick={onPrev}
				aria-label="Previous"
			>
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
				</svg>
			</button>
		{:else}
			<div class="p-3"></div>
		{/if}

		{#if hasNext}
			<button
				class="bg-black/30 hover:bg-black/50 rounded-full p-3 text-white"
				onclick={onNext}
				aria-label="Next"
			>
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
				</svg>
			</button>
		{:else}
			<div class="p-3"></div>
		{/if}
	</div>

	<!-- Bottom EXIF bar -->
	<div class="pointer-events-auto bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-center text-xs text-white/80">
		{fmtDate(meta?.created_at ?? item.created_at)} &nbsp;|&nbsp;
		{fmtAperture(meta?.aperture ?? null)} &nbsp;|&nbsp;
		{@html fmtShutter(meta?.shutter_speed ?? null)} &nbsp;|&nbsp;
		ISO {fmt(meta?.iso ?? null)} &nbsp;|&nbsp;
		{fmt(meta?.focal_length_35mm_equiv ?? null, 'mm')}
	</div>
</div>

<!-- Mobile overlay -->
<div class="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between md:hidden">
	<!-- Top bar -->
	<div class="pointer-events-auto flex items-center bg-gradient-to-b from-black/60 to-transparent px-4 py-3">
		<button
			class="text-white/80 hover:text-white mr-4 flex items-center gap-2 text-sm"
			onclick={onBack}
			aria-label="Back"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
			</svg>
		</button>
		<span class="flex-1 truncate text-center text-sm font-medium text-white/90">{collectionName}</span>
	</div>

	<!-- Center nav arrows -->
	<div class="pointer-events-auto flex items-center justify-between px-2">
		{#if hasPrev}
			<button
				class="bg-black/30 rounded-full p-4 text-white active:bg-black/60"
				onclick={onPrev}
				aria-label="Previous"
			>
				<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
				</svg>
			</button>
		{:else}
			<div class="p-4"></div>
		{/if}

		{#if hasNext}
			<button
				class="bg-black/30 rounded-full p-4 text-white active:bg-black/60"
				onclick={onNext}
				aria-label="Next"
			>
				<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
				</svg>
			</button>
		{:else}
			<div class="p-4"></div>
		{/if}
	</div>

	<!-- Bottom EXIF strip -->
	<div class="pointer-events-auto bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-center text-xs text-white/70">
		{fmtDate(meta?.created_at ?? item.created_at)} &nbsp;&bull;&nbsp;
		{fmtAperture(meta?.aperture ?? null)} &nbsp;&bull;&nbsp;
		{@html fmtShutter(meta?.shutter_speed ?? null)} &nbsp;&bull;&nbsp;
		ISO {fmt(meta?.iso ?? null)}
	</div>
</div>

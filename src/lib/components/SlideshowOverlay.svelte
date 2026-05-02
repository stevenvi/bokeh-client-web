<script lang="ts">
	import type { PhotoItem } from '$lib/types';
	import BackButton from './BackButton.svelte';

	interface Props {
		item: PhotoItem;
		collectionName: string;
		total: number;
		hasPrev: boolean;
		hasNext: boolean;
		showCounter?: boolean;
		onPrev: () => void;
		onNext: () => void;
		onBack: () => void;
	}

	let {
		item,
		collectionName,
		total,
		hasPrev,
		hasNext,
		showCounter = true,
		onPrev,
		onNext,
		onBack
	}: Props = $props();

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
		<span class="mr-4"><BackButton onclick={(e) => { e.stopPropagation(); onBack(); }} /></span>
		<span class="flex-1 select-none text-center text-sm font-medium text-white/90">{collectionName}</span>
		{#if showCounter}
			<span class="text-white/80 text-sm font-medium">{item.ordinal + 1} / {total}</span>
		{/if}
	</div>

	<!-- Center nav arrows -->
	<div class="pointer-events-auto flex items-center justify-between px-4">
		{#if hasPrev}
			<button
				class="bg-black/30 hover:bg-black/50 rounded-full p-3 text-white"
				onclick={(e) => { e.stopPropagation(); onPrev(); }}
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
				onclick={(e) => { e.stopPropagation(); onNext(); }}
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

	<!-- Bottom EXIF bar (large screen) -->
	<div class="pointer-events-auto select-none bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-center text-xs text-white/80">
		{fmtDate(item.created_at)} &nbsp;|&nbsp;
		{fmtAperture(item.aperture)} &nbsp;|&nbsp;
		{@html fmtShutter(item.shutter_speed)} &nbsp;|&nbsp;
		ISO {fmt(item.iso)} &nbsp;|&nbsp;
		{fmt(item.focal_length_35mm_equiv ?? item.focal_length_mm, 'mm')}
		<br>
		{fmt(item.camera_model)} &nbsp;|&nbsp; {fmt(item.lens_model)}
	</div>
</div>

<!-- Mobile overlay -->
<div class="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between md:hidden">
	<!-- Top bar -->
	<div class="pointer-events-auto flex items-center bg-gradient-to-b from-black/60 to-transparent px-4 py-3">
		<span class="mr-4"><BackButton onclick={(e) => { e.stopPropagation(); onBack(); }} /></span>
		<span class="flex-1 select-none truncate text-center text-sm font-medium text-white/90">{collectionName}</span>
		{#if showCounter}
			<span class="text-white/80 text-sm font-medium">{item.ordinal + 1} / {total}</span>
		{/if}
	</div>

	<!-- Center nav arrows -->
	<div class="pointer-events-auto flex items-center justify-between px-2">
		{#if hasPrev}
			<button
				class="bg-black/30 rounded-full p-4 text-white active:bg-black/60"
				onclick={(e) => { e.stopPropagation(); onPrev(); }}
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
				onclick={(e) => { e.stopPropagation(); onNext(); }}
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

	<!-- Bottom EXIF strip (mobile) -->
	<div class="pointer-events-auto select-none bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-center text-xs text-white/70">
		{fmtDate(item.created_at)} &nbsp;&bull;&nbsp;
		{fmtAperture(item.aperture)} &nbsp;&bull;&nbsp;
		{@html fmtShutter(item.shutter_speed)} &nbsp;&bull;&nbsp;
		ISO {fmt(item.iso)} &nbsp;&bull;&nbsp;
		{fmt(item.focal_length_35mm_equiv ?? item.focal_length_mm, 'mm')}
	</div>
</div>

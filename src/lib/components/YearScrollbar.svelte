<script lang="ts">
	import type { SlideshowMonthCount } from '$lib/api/collections';

	interface Props {
		metadata: SlideshowMonthCount[] | null;
		currentDate: string | null;
		onJump?: (date: string) => void;
	}

	let { metadata, currentDate, onJump }: Props = $props();

	const MONTH_NAMES = [
		'', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
		'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
	];

	// Compute whether to show the sidebar and its layout data
	const layout = $derived(() => {
		if (!metadata || metadata.length < 6) return null;
		const totalCount = metadata.reduce((sum, m) => sum + m.count, 0);
		if (totalCount <= 200) return null;

		const years = new Set(metadata.map((m) => m.year));
		const singleYear = years.size === 1;

		// Build segments: each month gets a proportional zone.
		// Segments are in the order they appear in metadata (server returns ASC).
		// For desc waterfall, we reverse so newest is at top.
		const segments = [...metadata].reverse().map((m) => ({
			year: m.year,
			month: m.month,
			count: m.count,
			proportion: m.count / totalCount,
			date: `${m.year}-${String(m.month).padStart(2, '0')}`,
			label: singleYear ? MONTH_NAMES[m.month] : null
		}));

		// Compute total proportion per year (for tick suppression in tiny groups)
		const yearProportions = new Map<number, number>();
		for (const seg of segments) {
			yearProportions.set(seg.year, (yearProportions.get(seg.year) ?? 0) + seg.proportion);
		}

		// Build year label positions as absolute percentages of the sidebar.
		const PADDING = 0.02;
		const usable = 1 - PADDING * 2;
		const yearLabelPositions: { year: number; top: number }[] = [];
		if (!singleYear) {
			const MIN_GAP = 0.025;
			let lastYear: number | null = null;
			let cumPos = 0;
			for (const seg of segments) {
				if (seg.year !== lastYear) {
					let pos = PADDING + cumPos * usable;
					if (yearLabelPositions.length > 0) {
						const prev = yearLabelPositions[yearLabelPositions.length - 1].top;
						if (pos - prev < MIN_GAP) {
							pos = prev + MIN_GAP;
						}
					}
					pos = Math.min(pos, 1 - PADDING - 0.01);
					yearLabelPositions.push({ year: seg.year, top: pos });
					lastYear = seg.year;
				}
				cumPos += seg.proportion;
			}
		}

		// Track which segment indices are year boundaries (for tick suppression)
		const yearBoundaryIndices = new Set<number>();
		if (!singleYear) {
			let lastYear: number | null = null;
			for (let i = 0; i < segments.length; i++) {
				if (segments[i].year !== lastYear) {
					yearBoundaryIndices.add(i);
					lastYear = segments[i].year;
				}
			}
		}

		// Build a lookup from date to segment index for fast access
		const dateToIndex = new Map<string, number>();
		for (let i = 0; i < segments.length; i++) {
			dateToIndex.set(segments[i].date, i);
		}

		// Pre-compute cumulative proportions for each segment
		const cumulativeProportions: number[] = [];
		let cum = 0;
		for (const seg of segments) {
			cumulativeProportions.push(cum);
			cum += seg.proportion;
		}

		return { segments, totalCount, singleYear, yearLabelPositions, yearBoundaryIndices, yearProportions, PADDING, usable, dateToIndex, cumulativeProportions };
	});

	// Indicator position based on which month element is at viewport center
	let indicatorProportion = $state(0);

	$effect(() => {
		if (!layout()) return;
		function onScroll() {
			if (dragging) return; // During drag, indicator follows pointer
			const l = layout()!;
			const centerY = window.innerHeight / 2;
			const elements = document.querySelectorAll<HTMLElement>('[data-date]');

			if (elements.length === 0) return;

			// Find which month element contains the viewport center
			let currentEl: HTMLElement | null = null;

			for (const el of elements) {
				const rect = el.getBoundingClientRect();
				if (rect.top <= centerY && rect.bottom >= centerY) {
					currentEl = el;
					break;
				}
			}

			if (!currentEl) {
				// Fallback: find closest element to center
				let closestDist = Infinity;
				for (const el of elements) {
					const rect = el.getBoundingClientRect();
					const midY = rect.top + rect.height / 2;
					const dist = Math.abs(midY - centerY);
					if (dist < closestDist) {
						closestDist = dist;
						currentEl = el;
					}
				}
			}

			if (!currentEl) return;

			const date = currentEl.dataset.date;
			if (!date) return;
			const segIdx = l.dateToIndex.get(date);
			if (segIdx === undefined) return;

			// Cumulative proportion before this segment + interpolated fraction within
			const rect = currentEl.getBoundingClientRect();
			const fractionThrough = Math.max(0, Math.min(1, (centerY - rect.top) / rect.height));
			indicatorProportion = l.cumulativeProportions[segIdx] + fractionThrough * l.segments[segIdx].proportion;
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		onScroll();
		return () => window.removeEventListener('scroll', onScroll);
	});

	const indicatorPosition = $derived(() => {
		const l = layout();
		if (!l) return null;
		const prop = dragging && dragProportion != null ? dragProportion : indicatorProportion;
		return l.PADDING + prop * l.usable;
	});

	// Drag state
	let dragging = $state(false);
	let dragProportion = $state<number | null>(null);
	let sidebarEl: HTMLDivElement | null = $state(null);

	function proportionAtY(clientY: number): number {
		if (!sidebarEl || !layout()) return 0;
		const l = layout()!;
		const rect = sidebarEl.getBoundingClientRect();
		const rawRatio = (clientY - rect.top) / rect.height;
		return Math.max(0, Math.min(1, (rawRatio - l.PADDING) / l.usable));
	}

	function segmentAtProportion(proportion: number): { date: string; fractionWithin: number } | null {
		const l = layout();
		if (!l) return null;
		let cumProportion = 0;
		for (let i = 0; i < l.segments.length; i++) {
			const nextCum = cumProportion + l.segments[i].proportion;
			if (proportion <= nextCum) {
				const fractionWithin = l.segments[i].proportion > 0
					? (proportion - cumProportion) / l.segments[i].proportion
					: 0;
				return { date: l.segments[i].date, fractionWithin };
			}
			cumProportion = nextCum;
		}
		const last = l.segments[l.segments.length - 1];
		return { date: last.date, fractionWithin: 1 };
	}

	function scrollToProportionIfLoaded(proportion: number) {
		const target = segmentAtProportion(proportion);
		if (!target) return;
		const el = document.querySelector<HTMLElement>(`[data-date="${target.date}"]`);
		if (el) {
			const rect = el.getBoundingClientRect();
			const targetPoint = rect.top + target.fractionWithin * rect.height;
			const offset = targetPoint - window.innerHeight / 2;
			window.scrollTo(0, Math.max(0, window.scrollY + offset));
		}
	}

	function onPointerDown(e: PointerEvent) {
		dragging = true;
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		const prop = proportionAtY(e.clientY);
		dragProportion = prop;
		scrollToProportionIfLoaded(prop);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const prop = proportionAtY(e.clientY);
		dragProportion = prop;
		scrollToProportionIfLoaded(prop);
	}

	function onPointerUp() {
		if (!dragging) return;
		dragging = false;
		if (dragProportion != null) {
			const target = segmentAtProportion(dragProportion);
			if (target) {
				const el = document.querySelector<HTMLElement>(`[data-date="${target.date}"]`);
				if (!el && onJump) {
					onJump(target.date);
				}
			}
		}
		dragProportion = null;
	}

	// Hide native scrollbar when sidebar is visible
	$effect(() => {
		const visible = layout() != null;
		if (visible) {
			document.body.classList.add('hide-scrollbar');
		}
		return () => {
			document.body.classList.remove('hide-scrollbar');
		};
	});
</script>

{#if layout()}
	{@const l = layout()!}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={sidebarEl}
		class="fixed right-0 top-10 z-20 flex w-10 flex-col select-none lg:w-14"
		style="height: calc(100dvh - 2.5rem); touch-action: none;"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		role="scrollbar"
		aria-controls="waterfall-content"
		aria-valuenow={indicatorPosition() != null ? Math.round(indicatorPosition()! * 100) : 0}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-label="Timeline scrollbar"
		tabindex="-1"
	>
		<!-- Top padding -->
		<div class="flex-none" style="height: {l.PADDING * 100}%;"></div>

		<!-- Proportional segments (tick marks only) -->
		{#each l.segments as seg, i (seg.date)}
			{@const isYearBoundary = l.yearBoundaryIndices.has(i)}
			{@const yearTooSmall = !l.singleYear && (l.yearProportions.get(seg.year) ?? 0) < 0.05}
			{@const showTick = i > 0 && !isYearBoundary && !yearTooSmall}
			<div
				class="relative flex-none"
				style="height: {seg.proportion * l.usable * 100}%;"
			>
				{#if showTick}
					<div class="bg-border absolute left-1 right-1 top-0 h-0.5"></div>
				{/if}

				<!-- Month label (single year only) -->
				{#if l.singleYear}
					<div class="absolute left-0 right-0 top-0 flex items-center justify-center">
						<span class="text-text-secondary bg-bg/80 px-0.5 text-[11px] leading-none lg:text-xs">
							{seg.label}
						</span>
					</div>
				{/if}
			</div>
		{/each}

		<!-- Bottom padding -->
		<div class="flex-none" style="height: {l.PADDING * 100}%;"></div>

		<!-- Year labels (absolute overlay, not clipped by segments) -->
		{#each l.yearLabelPositions as lbl (lbl.year)}
			<div
				class="pointer-events-none absolute left-0 right-0 flex items-center justify-center"
				style="top: {lbl.top * 100}%; transform: translateY(-50%);"
			>
				<span class="text-text-secondary bg-bg/80 px-0.5 text-xs font-semibold leading-none lg:text-sm">
					{lbl.year}
				</span>
			</div>
		{/each}

		<!-- Scroll position indicator (centered on position, sized to encompass year label) -->
		{#if indicatorPosition() != null}
			<div
				class="bg-accent/70 pointer-events-none absolute left-0.5 right-0.5 rounded-full"
				style="top: {indicatorPosition()! * 100}%; height: 20px; transform: translateY(-50%);"
			></div>
		{/if}
	</div>
{/if}

<style>
	:global(body.hide-scrollbar) {
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
	:global(body.hide-scrollbar::-webkit-scrollbar) {
		display: none;
	}
</style>

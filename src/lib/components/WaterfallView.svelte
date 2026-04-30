<script lang="ts">
	import { createInfiniteQuery, createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { tick, untrack } from 'svelte';
	import { listPhotos, photoStats } from '$lib/api/collections';
	import { navigationStore } from '$lib/stores/navigation';
	import { slideshowStore } from '$lib/stores/slideshow';
	import MonthGroup from './MonthGroup.svelte';
	import ScrollRestore from './ScrollRestore.svelte';
	import YearScrollbar from './YearScrollbar.svelte';
	import type { PhotoItem, SlideshowMonthCount } from '$lib/types';

	interface Props {
		collectionId: number;
		collectionName: string;
		basePath: string;
	}

	let { collectionId, collectionName, basePath }: Props = $props();

	type PageParam = { offset: number; limit: number };
	const PAGE_LIMIT = 200;
	const SERVER_MAX_LIMIT = 1000;

	// Initialize synchronously so the very first render uses the correct query
	// key — otherwise the cached infinite-query for the saved jumpTarget never
	// shows on return from slideshow and the user gets bounced to the top.
	let jumpTarget = $state<string | null>(navigationStore.getJumpTarget(untrack(() => collectionId)));

	// When the user clicks a sidebar position whose month isn't loaded yet,
	// remember the requested fraction so we can scroll to it once the new
	// query's data has rendered. Without this, the user lands at the start
	// of the month and has to click again.
	let pendingScrollTarget = $state<{ date: string; fractionWithin: number } | null>(null);

	$effect(() => {
		return () => {
			navigationStore.saveJumpTarget(collectionId, jumpTarget);
		};
	});

	/** Compute offset for a YYYY-MM jump target given the months array (desc order). */
	function computeOffset(months: SlideshowMonthCount[], date: string): number {
		const [yearStr, monthStr] = date.split('-');
		const targetYear = parseInt(yearStr, 10);
		const targetMonth = parseInt(monthStr, 10);
		let offset = 0;
		for (const m of months) {
			if (m.year > targetYear || (m.year === targetYear && m.month > targetMonth)) {
				offset += m.count;
			}
		}
		return offset;
	}

	// Stats query — used for year scrollbar and jump-to-month offset computation
	const statsQuery = $derived(
		createQuery({
			queryKey: ['photoStats', collectionId, 'recursive'],
			queryFn: () => photoStats(collectionId, true)
		})
	);

	// Compute initial offset from jump target + stats
	const initialOffset = $derived.by(() => {
		if (!jumpTarget) return 0;
		const months = $statsQuery.data?.months;
		if (!months) return 0;
		return computeOffset(months, jumpTarget);
	});

	// When jumping into a specific month, bias the initial fetch to cover as
	// much of that month as possible so the layout is stable when the user
	// scrolls. Capped at the server-side per-page maximum.
	const initialLimit = $derived.by(() => {
		if (!jumpTarget) return PAGE_LIMIT;
		const months = $statsQuery.data?.months;
		if (!months) return PAGE_LIMIT;
		const monthCount = monthCountFor(months, jumpTarget);
		return Math.max(PAGE_LIMIT, Math.min(monthCount, SERVER_MAX_LIMIT));
	});

	function monthCountFor(months: SlideshowMonthCount[], date: string): number {
		const [yStr, mStr] = date.split('-');
		const ty = parseInt(yStr, 10);
		const tm = parseInt(mStr, 10);
		return months.find((m) => m.year === ty && m.month === tm)?.count ?? 0;
	}

	const waterfallQuery = $derived(
		createInfiniteQuery({
			queryKey: ['waterfall', collectionId, jumpTarget],
			queryFn: ({ pageParam }) => {
				const p = pageParam as PageParam;
				return listPhotos(collectionId, {
					sortOrder: 'desc',
					recursive: true,
					offset: p.offset,
					limit: p.limit
				});
			},
			initialPageParam: { offset: initialOffset, limit: initialLimit } as PageParam,
			getNextPageParam: (lastPage, allPages): PageParam | undefined => {
				const total = $statsQuery.data?.total;
				if (total != null && allPages.flatMap((p) => p.items).length >= total) return undefined;
				return lastPage.items.length < lastPage.limit
					? undefined
					: { offset: lastPage.offset + lastPage.limit, limit: PAGE_LIMIT };
			},
			// Bidirectional pagination: when the user starts mid-collection
			// (because they clicked the sidebar to jump), they need to be able
			// to scroll up to load newer months. Each prepend is capped at
			// PAGE_LIMIT so the JSON response returns quickly and the items
			// closest to the viewport (bottom of the prepended chunk) get into
			// the DOM fast — native lazy-loading then prioritizes thumbnails
			// near the viewport. prependPage() loops to fill the rest of the
			// topmost month so the layout stays stable.
			getPreviousPageParam: (firstPage): PageParam | undefined => {
				if (firstPage.offset <= 0) return undefined;
				const newLimit = Math.min(PAGE_LIMIT, firstPage.offset);
				return { offset: firstPage.offset - newLimit, limit: newLimit };
			}
		})
	);

	const allItems = $derived(($waterfallQuery.data?.pages ?? []).flatMap((p) => p.items));

	const monthGroups = $derived(() => {
		const groups: { label: string; date: string; items: PhotoItem[] }[] = [];
		const map = new Map<string, PhotoItem[]>();

		for (const item of allItems) {
			const d = new Date(item.created_at ?? new Date().toISOString());
			const year = d.getFullYear();
			const month = d.getMonth() + 1;
			const date = `${year}-${String(month).padStart(2, '0')}`;
			const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
			if (!map.has(date)) {
				map.set(date, []);
				groups.push({ label, date, items: map.get(date)! });
			}
			map.get(date)!.push(item);
		}
		return groups;
	});

	// Column count based on viewport width
	let columnCount = $state(getColumnCount());

	function getColumnCount(): number {
		if (typeof window === 'undefined') return 2;
		const w = window.innerWidth;
		if (w < 640) return 2;
		if (w < 768) return 3;
		if (w < 1024) return 4;
		return 6;
	}

	$effect(() => {
		function onResize() {
			columnCount = getColumnCount();
		}
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	// Bottom sentinel (next page)
	let bottomSentinel: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (!bottomSentinel) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (
					entry.isIntersecting &&
					$waterfallQuery.hasNextPage &&
					!$waterfallQuery.isFetchingNextPage
				) {
					$waterfallQuery.fetchNextPage();
				}
			},
			{ rootMargin: '300px' }
		);
		observer.observe(bottomSentinel);
		return () => observer.disconnect();
	});

	// Top sentinel (previous page) — scrolling up past it loads earlier pages
	// (newer months above the initial jump target). We capture the scroll
	// position before the fetch and restore it after the new content has been
	// rendered, so the user's view stays anchored to the same content.
	let topSentinel: HTMLDivElement | null = $state(null);
	let isPrepending = false;

	$effect(() => {
		if (!topSentinel) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (
					entry.isIntersecting &&
					$waterfallQuery.hasPreviousPage &&
					!$waterfallQuery.isFetchingPreviousPage &&
					!isPrepending
				) {
					void prependPage();
				}
			},
			{ rootMargin: '300px' }
		);
		observer.observe(topSentinel);
		return () => observer.disconnect();
	});

	function isTopSentinelInTriggerRange(): boolean {
		if (!topSentinel) return false;
		const rect = topSentinel.getBoundingClientRect();
		// Mirrors the IntersectionObserver's rootMargin: '300px' against the viewport.
		return rect.bottom > -300 && rect.top < window.innerHeight + 300;
	}

	function topMonthIsComplete(): boolean {
		const months = $statsQuery.data?.months;
		if (!months) return true;
		const groups = monthGroups();
		if (groups.length === 0) return true;
		const top = groups[0];
		const expected = monthCountFor(months, top.date);
		if (expected === 0) return true;
		return top.items.length >= expected;
	}

	async function prependPage() {
		if (isPrepending) return;
		isPrepending = true;
		try {
			// Loop while the sentinel is still in trigger range OR the topmost
			// month is only partially loaded. The first condition handles fast
			// scroll-up (IntersectionObserver only fires on transitions); the
			// second guarantees a full month sits at the top so further loading
			// doesn't shift the layout.
			let safety = 50;
			while (safety-- > 0 && $waterfallQuery.hasPreviousPage) {
				const c = document.getElementById('app-scroll');
				const oldHeight = c?.scrollHeight ?? 0;
				const oldTop = c?.scrollTop ?? 0;
				await $waterfallQuery.fetchPreviousPage();
				await tick();
				const c2 = document.getElementById('app-scroll');
				if (c2) {
					const delta = c2.scrollHeight - oldHeight;
					if (delta > 0) c2.scrollTop = oldTop + delta;
				}
				if (!topMonthIsComplete()) continue;
				if (!isTopSentinelInTriggerRange()) break;
			}
		} finally {
			isPrepending = false;
		}
	}

	// After a jump, scroll to the requested fraction within the target month.
	// We must wait until the month is fully loaded — otherwise `fractionWithin`
	// maps to a fraction of the partially loaded month element, which puts the
	// user in the wrong place and forces the layout to shift as more pages
	// arrive while they scroll. Stats give us the expected item count per
	// month, so we fetch next pages until the loaded count matches before
	// computing the scroll position.
	$effect(() => {
		if (!pendingScrollTarget) return;
		const target = pendingScrollTarget;
		let cancelled = false;
		let attempts = 0;
		let isFetching = false;

		async function tryScroll() {
			if (cancelled) return;

			const months = $statsQuery.data?.months;
			if (!months) {
				if (attempts++ > 600) { pendingScrollTarget = null; return; }
				requestAnimationFrame(tryScroll);
				return;
			}

			const expectedCount = monthCountFor(months, target.date);
			const grp = monthGroups().find((g) => g.date === target.date);
			const loadedCount = grp?.items.length ?? 0;

			if (expectedCount > 0 && loadedCount < expectedCount) {
				if (
					!isFetching &&
					$waterfallQuery.hasNextPage &&
					!$waterfallQuery.isFetchingNextPage
				) {
					isFetching = true;
					try {
						await $waterfallQuery.fetchNextPage();
						await tick();
					} finally {
						isFetching = false;
					}
				}
				if (cancelled) return;
				if (attempts++ > 600) { pendingScrollTarget = null; return; }
				requestAnimationFrame(tryScroll);
				return;
			}

			const el = document.querySelector<HTMLElement>(`[data-date="${target.date}"]`);
			const c = document.getElementById('app-scroll');
			if (el && c) {
				const elRect = el.getBoundingClientRect();
				const cRect = c.getBoundingClientRect();
				const centerY = cRect.top + cRect.height / 2;
				const targetPoint = elRect.top + target.fractionWithin * elRect.height;
				const offset = targetPoint - centerY;
				c.scrollTo(0, Math.max(0, c.scrollTop + offset));
				pendingScrollTarget = null;
				return;
			}
			if (attempts++ > 600) { pendingScrollTarget = null; return; }
			requestAnimationFrame(tryScroll);
		}
		requestAnimationFrame(tryScroll);
		return () => { cancelled = true; };
	});

	function handleItemClick(item: PhotoItem) {
		slideshowStore.set({
			collectionId,
			items: allItems,
			total: $statsQuery.data?.total ?? 0,
			params: { sortOrder: 'desc', recursive: true }
		});
		goto(`${basePath}/slideshow/${item.ordinal}`);
	}

	// Whether the year scrollbar will be visible (mirrors its internal logic)
	const showScrollbar = $derived(() => {
		const months = $statsQuery.data?.months;
		if (!months || months.length < 6) return false;
		const totalCount = months.reduce((sum, m) => sum + m.count, 0);
		return totalCount > 200;
	});
</script>

<div class="relative {showScrollbar() ? 'pr-10 lg:pr-14' : ''}">
	{#if $waterfallQuery.isPending}
		<div class="flex h-48 items-center justify-center">
			<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
		</div>
	{:else if $waterfallQuery.isError}
		<p class="text-error px-4 py-6">Failed to load items.</p>
	{:else if allItems.length === 0}
		<p class="text-text-secondary px-4 py-6 text-sm">No items in this collection.</p>
	{:else}
		<div bind:this={topSentinel} class="h-1"></div>
		{#if $waterfallQuery.isFetchingPreviousPage}
			<div class="flex justify-center py-4">
				<div class="border-accent h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"></div>
			</div>
		{/if}
		{#each monthGroups() as group (group.date)}
			<MonthGroup
				label={group.label}
				date={group.date}
				items={group.items}
				{columnCount}
				onItemClick={handleItemClick}
			/>
		{/each}
		<div bind:this={bottomSentinel} class="h-1"></div>
		{#if $waterfallQuery.isFetchingNextPage}
			<div class="flex justify-center py-4">
				<div class="border-accent h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"></div>
			</div>
		{/if}
	{/if}

	<YearScrollbar
		metadata={$statsQuery.data?.months ?? null}
		onJump={(date, fractionWithin) => {
			jumpTarget = date;
			pendingScrollTarget = { date, fractionWithin };
		}}
	/>
</div>

<ScrollRestore path={basePath} />

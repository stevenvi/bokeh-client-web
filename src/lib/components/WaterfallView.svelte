<script lang="ts">
	import { createInfiniteQuery, createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { listPhotos, photoStats } from '$lib/api/collections';
	import { navigationStore } from '$lib/stores/navigation';
	import { slideshowStore } from '$lib/stores/slideshow';
	import MonthGroup from './MonthGroup.svelte';
	import YearScrollbar from './YearScrollbar.svelte';
	import type { PhotoItem, SlideshowMonthCount } from '$lib/types';

	interface Props {
		collectionId: number;
		collectionName: string;
	}

	let { collectionId, collectionName }: Props = $props();

	// Jump target: when set, the infinite query starts from this month instead of the beginning.
	// Restored from navigationStore so returning from slideshow uses the same query cache key.
	// Uses $effect so it re-reads the correct value if collectionId changes (component reuse across navigations).
	let jumpTarget = $state<string | null>(null);

	$effect(() => {
		const id = collectionId;
		jumpTarget = navigationStore.getJumpTarget(id);
		return () => {
			navigationStore.saveJumpTarget(id, jumpTarget);
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

	const waterfallQuery = $derived(
		createInfiniteQuery({
			queryKey: ['waterfall', collectionId, jumpTarget],
			queryFn: ({ pageParam }) =>
				listPhotos(collectionId, {
					sortOrder: 'desc',
					recursive: true,
					offset: pageParam as number,
					limit: 200
				}),
			initialPageParam: initialOffset,
			getNextPageParam: (lastPage, allPages) => {
				const total = $statsQuery.data?.total;
				if (total != null && allPages.flatMap((p) => p.items).length >= total) return undefined;
				return lastPage.items.length < lastPage.limit
					? undefined
					: lastPage.offset + lastPage.limit;
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

	// Infinite scroll sentinel
	let sentinel: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (!sentinel) return;
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
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	// Current date tracking — find which MonthGroup is at the viewport center
	let currentDate = $state<string | null>(null);

	$effect(() => {
		function onScroll() {
			const centerY = window.innerHeight / 2;
			const elements = document.querySelectorAll<HTMLElement>('[data-date]');
			let closest: HTMLElement | null = null;
			let closestDist = Infinity;

			for (const el of elements) {
				const rect = el.getBoundingClientRect();
				// Use the top of the element's bounding box distance to center
				const dist = Math.abs(rect.top - centerY);
				if (dist < closestDist) {
					closestDist = dist;
					closest = el;
				}
				// Also check if center is within the element
				if (rect.top <= centerY && rect.bottom >= centerY) {
					closest = el;
					break;
				}
			}

			if (closest) {
				currentDate = closest.dataset.date ?? null;
			}
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		// Run once on mount
		onScroll();
		return () => window.removeEventListener('scroll', onScroll);
	});

	function handleItemClick(item: PhotoItem) {
		slideshowStore.set({
			collectionId,
			items: allItems,
			total: $statsQuery.data?.total ?? 0,
			params: { sortOrder: 'desc', recursive: true }
		});
		goto(`/collection/${collectionId}/items/${item.id}/slideshow/waterfall?name=${encodeURIComponent(collectionName)}`);
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
		{#each monthGroups() as group (group.date)}
			<MonthGroup
				label={group.label}
				date={group.date}
				items={group.items}
				{columnCount}
				onItemClick={handleItemClick}
			/>
		{/each}
		<div bind:this={sentinel} class="h-1"></div>
		{#if $waterfallQuery.isFetchingNextPage}
			<div class="flex justify-center py-4">
				<div class="border-accent h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"></div>
			</div>
		{/if}
	{/if}

	<YearScrollbar
		metadata={$statsQuery.data?.months ?? null}
		{currentDate}
		onJump={(date) => {
			jumpTarget = date;
		}}
	/>
</div>

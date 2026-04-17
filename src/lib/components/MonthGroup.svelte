<script lang="ts">
	import MediaTile from './MediaTile.svelte';
	import type { SlideshowItem } from '$lib/types';

	interface Props {
		label: string;
		date: string; // "YYYY-MM" for scroll tracking
		items: SlideshowItem[];
		columnCount: number;
		onItemClick: (item: SlideshowItem) => void;
	}

	let { label, date, items, columnCount, onItemClick }: Props = $props();

	// Distribute items into the shortest column (by estimated height) for balanced fill.
	const columns = $derived(() => {
		const cols: SlideshowItem[][] = Array.from({ length: columnCount }, () => []);
		const heights = new Array<number>(columnCount).fill(0);
		for (const item of items) {
			// Find the shortest column (ties go to the leftmost)
			let minIdx = 0;
			for (let c = 1; c < columnCount; c++) {
				if (heights[c] < heights[minIdx]) minIdx = c;
			}
			cols[minIdx].push(item);
			// Estimate height from aspect ratio; default to square if unknown
			const ar = item.width_px && item.height_px ? item.width_px / item.height_px : 1;
			heights[minIdx] += 1 / ar;
		}
		return cols;
	});
</script>

<div class="mb-6" data-date={date}>
	<div class="flex items-center gap-3 px-4 py-2">
		<div class="bg-border h-px flex-1"></div>
		<h3 class="text-text-muted text-sm font-medium">{label}</h3>
		<div class="bg-border h-px flex-1"></div>
	</div>
	<div class="flex gap-0.5 px-0.5">
		{#each columns() as column, colIdx (colIdx)}
			<div class="flex flex-1 flex-col gap-0.5">
				{#each column as item (item.id)}
					<MediaTile
						id={item.id}
						title={item.title}
						hasVariants={true}
						aspectRatio={item.width_px && item.height_px ? item.width_px / item.height_px : null}
						onclick={() => onItemClick(item)}
					/>
				{/each}
			</div>
		{/each}
	</div>
</div>

<script lang="ts">
	import MediaTile from './MediaTile.svelte';
	import type { PhotoItem } from '$lib/types';

	interface Props {
		items: PhotoItem[];
		columnCount: number;
		onItemClick: (item: PhotoItem) => void;
	}

	let { items, columnCount, onItemClick }: Props = $props();

	const columns = $derived(() => {
		const cols: PhotoItem[][] = Array.from({ length: columnCount }, () => []);
		const heights = new Array<number>(columnCount).fill(0);
		for (const item of items) {
			let minIdx = 0;
			for (let c = 1; c < columnCount; c++) {
				if (heights[c] < heights[minIdx]) minIdx = c;
			}
			cols[minIdx].push(item);
			const ar = item.width_px && item.height_px ? item.width_px / item.height_px : 1;
			heights[minIdx] += 1 / ar;
		}
		return cols;
	});
</script>

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

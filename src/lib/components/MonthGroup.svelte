<script lang="ts">
	import PhotoColumnGrid from './PhotoColumnGrid.svelte';
	import type { PhotoItem } from '$lib/types';

	interface Props {
		label: string;
		date: string; // "YYYY-MM" for scroll tracking
		items: PhotoItem[];
		columnCount: number;
		onItemClick: (item: PhotoItem) => void;
	}

	let { label, date, items, columnCount, onItemClick }: Props = $props();
</script>

<div class="mb-6" data-date={date}>
	<div class="flex items-center gap-3 px-4 py-2">
		<div class="bg-border h-px flex-1"></div>
		<h3 class="text-text-primary text-sm font-medium">{label}</h3>
		<div class="bg-border h-px flex-1"></div>
	</div>
	<PhotoColumnGrid {items} {columnCount} {onItemClick} />
</div>

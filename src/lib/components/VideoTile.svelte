<script lang="ts">
	import MediaDate from './MediaDate.svelte';
	import { videoCoverUrl } from '$lib/api/video';
	import { videoCoverBust } from '$lib/stores/coverBust';
	import { IconVideo } from './icons';

	interface Props {
		id: number;
		title: string;
		date?: string | null;
		aspectRatio: string;
		bookmarkSeconds?: number | null;
		durationSeconds?: number | null;
		author?: string | null;
		onclick: () => void;
	}

	let {
		id,
		title,
		date = null,
		aspectRatio,
		bookmarkSeconds = null,
		durationSeconds = null,
		author = null,
		onclick
	}: Props = $props();

	const pct = $derived(
		bookmarkSeconds != null && durationSeconds && durationSeconds > 0
			? Math.min(100, (bookmarkSeconds / durationSeconds) * 100)
			: null
	);
</script>

<button class="group flex w-full flex-col text-left" {onclick}>
	<div
		class="relative w-full overflow-hidden rounded-lg bg-surface-raised"
		style="aspect-ratio: {aspectRatio}"
	>
		<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
			<IconVideo class="text-text-muted h-12 w-12 opacity-30" />
		</div>
		{#key $videoCoverBust[id]}
			<img
				src={videoCoverUrl(id) + ($videoCoverBust[id] ? `?v=${$videoCoverBust[id]}` : '')}
				alt=""
				class="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
				onerror={(e) => {
					(e.currentTarget as HTMLImageElement).style.display = 'none';
				}}
			/>
		{/key}
		{#if pct != null}
			<div class="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
				<div class="h-full bg-red-500" style="width: {pct}%"></div>
			</div>
		{/if}
	</div>
	<p class="text-text-primary text-shadow-dark mt-2 truncate text-sm font-medium">{title}</p>
	<MediaDate value={date} />
	{#if author}
		<p class="text-text-secondary text-xs truncate">{author}</p>
	{/if}
</button>

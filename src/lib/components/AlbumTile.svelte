<script lang="ts">
	import { albumCoverUrl } from '$lib/api/music';

	interface Props {
		albumId: number;
		name: string;
		year: number | null;
		bust?: number;
		onClickTitle?: () => void;
		onClickImage?: () => void;
	}

	let { albumId, name, year, bust, onClickTitle, onClickImage }: Props = $props();
	let coverLoaded = $state(false);
	let coverError = $state(false);
	let hovered = $state(false);

	$effect(() => {
		// Reset image state when bust changes so the new cover is fetched
		if (bust !== undefined) {
			coverLoaded = false;
			coverError = false;
		}
	});
</script>

<div
	class="group w-full"
	onmouseenter={() => (hovered = true)}
	onmouseleave={() => (hovered = false)}
>
	<div
		class="relative bg-surface-raised aspect-square w-full overflow-hidden rounded-lg transition-opacity cursor-pointer"
		role="button"
		tabindex="0"
		onclick={onClickTitle}
		onkeydown={(e) => e.key === 'Enter' && onClickTitle?.()}
	>
		{#if !coverError}
			<img
				src={albumCoverUrl(albumId, bust)}
				alt=""
				class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
				class:opacity-0={!coverLoaded}
				onload={() => (coverLoaded = true)}
				onerror={() => (coverError = true)}
			/>
		{/if}
		<div
			class="absolute inset-0 flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-raised to-border transition-opacity duration-300"
			class:opacity-0={coverLoaded && !coverError}
		>
			<svg class="text-text-muted h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
			</svg>
		</div>
		<!-- Play button overlay on hover -->
		{#if hovered}
			<div class="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity">
				<button
					class="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg"
					onclick={(e) => { e.stopPropagation(); onClickImage?.(); }}
					aria-label="Play album"
				>
					<svg class="ml-1 h-7 w-7 text-black" fill="currentColor" viewBox="0 0 24 24">
						<path d="M8 5v14l11-7z" />
					</svg>
				</button>
			</div>
		{/if}
	</div>
	<button class="mt-2 w-full text-left hover:underline" onclick={onClickTitle}>
		<p class="text-text-primary line-clamp-2 text-sm font-medium">{name}</p>
	</button>
	{#if year}
		<p class="text-text-muted text-xs">{year}</p>
	{/if}
</div>

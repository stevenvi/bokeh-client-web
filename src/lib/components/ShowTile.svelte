<script lang="ts">
	import { artistImageUrl } from '$lib/api/music';

	interface Props {
		showId: number;
		name: string;
		bust?: number;
		onClickTitle?: () => void;
	}

	let { showId, name, bust, onClickTitle }: Props = $props();
	let imageLoaded = $state(false);
	let imageError = $state(false);
	let hovered = $state(false);

	$effect(() => {
		if (bust !== undefined) {
			imageLoaded = false;
			imageError = false;
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
		{#if !imageError}
			<img
				src={artistImageUrl(showId) + (bust ? `?v=${bust}` : '')}
				alt=""
				class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
				class:opacity-0={!imageLoaded}
				onload={() => (imageLoaded = true)}
				onerror={() => (imageError = true)}
			/>
		{/if}
		<div
			class="absolute inset-0 flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-raised to-border transition-opacity duration-300"
			class:opacity-0={imageLoaded && !imageError}
		>
			<!-- Radio wave icon for shows -->
			<svg class="text-text-muted h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
			</svg>
		</div>
		{#if hovered}
			<div class="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity">
				<button
					class="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg"
					onclick={(e) => { e.stopPropagation(); onClickTitle?.(); }}
					aria-label="Open show"
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
</div>

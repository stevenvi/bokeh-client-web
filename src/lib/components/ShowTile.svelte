<script lang="ts">
	import { artistImageUrl } from '$lib/api/music';
	import { IconRadio, IconPlay } from './icons';

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
			<IconRadio class="text-text-muted h-12 w-12" />
		</div>
		{#if hovered}
			<div class="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity">
				<button
					class="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg"
					onclick={(e) => { e.stopPropagation(); onClickTitle?.(); }}
					aria-label="Open show"
				>
					<IconPlay class="ml-1 h-7 w-7 text-black" />
				</button>
			</div>
		{/if}
	</div>
	<button class="mt-2 w-full text-left hover:underline" onclick={onClickTitle}>
		<p class="text-text-primary line-clamp-2 text-sm font-medium">{name}</p>
	</button>
</div>

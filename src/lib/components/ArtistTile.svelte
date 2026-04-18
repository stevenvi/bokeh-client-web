<script lang="ts">
	import { artistImageUrl } from '$lib/api/music';

	interface Props {
		id: number;
		name: string;
		bust?: number;
		onclick?: () => void;
	}

	let { id, name, bust, onclick }: Props = $props();
	let imageLoaded = $state(false);
	let imageError = $state(false);

	$effect(() => {
		if (bust !== undefined) {
			imageLoaded = false;
			imageError = false;
		}
	});
</script>

<button class="group w-full text-left" {onclick}>
	<div class="relative bg-surface-raised aspect-square w-full overflow-hidden rounded-lg transition-opacity group-hover:opacity-80">
		{#if !imageError}
			<img
				src={artistImageUrl(id) + (bust ? `?v=${bust}` : '')}
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
			<svg class="text-text-muted h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
			</svg>
		</div>
	</div>
	<p class="text-text-primary mt-2 text-sm font-medium">{name}</p>
</button>

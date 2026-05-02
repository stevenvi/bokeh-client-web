<script lang="ts">
	import { artistImageUrl } from '$lib/api/music';
	import { IconMusic } from './icons';

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
			<IconMusic class="text-text-muted h-12 w-12" />
		</div>
	</div>
	<p class="text-text-primary mt-2 text-sm font-medium">{name}</p>
</button>

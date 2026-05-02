<script lang="ts">
	import { imageVariantUrl } from '$lib/api/media';
	import { IconCamera } from './icons';

	interface Props {
		id: number;
		title: string;
		hasVariants: boolean;
		/** When set, tile uses natural aspect ratio instead of square crop. */
		aspectRatio?: number | null;
		onclick?: () => void;
	}

	let { id, title, hasVariants, aspectRatio = null, onclick }: Props = $props();

	let thumbLoaded = $state(false);
</script>

<button
	class="group relative w-full overflow-hidden rounded-sm bg-surface-raised"
	class:aspect-square={!aspectRatio}
	style={aspectRatio ? `aspect-ratio: ${aspectRatio}` : ''}
	{onclick}
>
	{#if !hasVariants}
		<!-- Not yet processed: show camera icon placeholder -->
		<div class="flex h-full w-full items-center justify-center">
			<IconCamera class="text-text-muted h-8 w-8" />
		</div>
	{:else}
		<!-- Pulse while thumbnail loads -->
		{#if !thumbLoaded}
			<div class="absolute inset-0 animate-pulse bg-surface-raised"></div>
		{/if}
		<!-- Full thumbnail (lazy-loaded) -->
		<img
			src={imageVariantUrl(id, 'thumb')}
			alt={title}
			loading="lazy"
			class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
			class:opacity-0={!thumbLoaded}
			onload={() => (thumbLoaded = true)}
		/>
	{/if}
</button>

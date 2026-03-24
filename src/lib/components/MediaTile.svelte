<script lang="ts">
	import { imageVariantUrl } from '$lib/api/media';

	interface Props {
		id: number;
		title: string;
		placeholder: string | null;
		hasVariants: boolean;
		/** When set, tile uses natural aspect ratio instead of square crop. */
		aspectRatio?: number | null;
		onclick?: () => void;
	}

	let { id, title, placeholder, hasVariants, aspectRatio = null, onclick }: Props = $props();

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
			<svg class="text-text-muted h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
			</svg>
		</div>
	{:else}
		<!-- Placeholder (low-res AVIF, shown immediately) -->
		{#if placeholder}
			<img
				src="data:image/webp;base64,{placeholder}"
				alt=""
				class="absolute inset-0 h-full w-full object-cover blur-sm scale-105 transition-opacity duration-300"
				class:opacity-0={thumbLoaded}
				aria-hidden="true"
			/>
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

<script lang="ts">
	import { collectionCoverUrl } from '$lib/api/media';

	interface Props {
		id: number;
		name: string;
		type: string;
		onclick?: () => void;
	}

	let { id, name, type, onclick }: Props = $props();
	let coverLoaded = $state(false);
	let coverError = $state(false);
</script>

<button class="group w-full text-left" {onclick}>
	<div class="relative bg-surface-raised aspect-square w-full overflow-hidden rounded-lg transition-opacity group-hover:opacity-80">
		<!-- Cover image (hidden until loaded; suppressed on error) -->
		{#if !coverError}
			<img
				src={collectionCoverUrl(id)}
				alt=""
				class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
				class:opacity-0={!coverLoaded}
				onload={() => (coverLoaded = true)}
				onerror={() => (coverError = true)}
			/>
		{/if}
		<!-- Placeholder gradient based on collection type -->
		<div
			class="absolute inset-0 flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-raised to-border transition-opacity duration-300"
			class:opacity-0={coverLoaded && !coverError}
		>
			{#if type === 'image:photo'}
				<svg class="text-text-muted h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
				</svg>
			{:else if type === 'video:movie'}
				<svg class="text-text-muted h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125V6.375m0 0A1.125 1.125 0 013.375 5.25h17.25a1.125 1.125 0 011.125 1.125M3.375 6.375v12m17.25-12v12a1.125 1.125 0 01-1.125 1.125M18 6.375v12" />
				</svg>
			{:else}
				<svg class="text-text-muted h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
				</svg>
			{/if}
		</div>
	</div>
	<p class="text-text-primary mt-2 line-clamp-2 h-10 text-sm font-medium">{name}</p>
</button>

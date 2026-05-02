<script lang="ts">
	import { collectionCoverUrl } from '$lib/api/media';
	import MediaDate from './MediaDate.svelte';
	import { coverBustStore } from '$lib/stores/coverBust';
	import {
		IconPhoto,
		IconMusic,
		IconFilm,
		IconFolderCollection,
		IconRadio,
		IconTypeRadioShow,
		IconTypeHomeMovie
	} from './icons';

	interface Props {
		id: number;
		name: string;
		type: string;
		date?: string | null;
		onclick?: () => void;
	}

	let { id, name, type, date, onclick }: Props = $props();
	let coverLoaded = $state(false);
	let coverError = $state(false);
</script>

<button class="group w-full text-left" {onclick}>
	<div class="relative bg-surface-raised aspect-square w-full overflow-hidden rounded-lg transition-opacity group-hover:opacity-80">
		<!-- Cover image (hidden until loaded; suppressed on error) -->
		{#if !coverError}
			<img
				src={collectionCoverUrl(id) + ($coverBustStore[id] ? `?v=${$coverBustStore[id]}` : '')}
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
				<IconPhoto class="text-text-muted h-12 w-12" />
			{:else if type === 'audio:music'}
				<IconMusic class="text-text-muted h-12 w-12" />
			{:else if type === 'audio:show'}
				<IconTypeRadioShow class="text-text-muted h-12 w-12" />
			{:else if type === 'video:movie'}
				<IconFilm class="text-text-muted h-12 w-12" />
			{:else if type === 'video:home_movie'}
				<IconTypeHomeMovie class="text-text-muted h-12 w-12" />
			{:else}
				<IconFolderCollection class="text-text-muted h-12 w-12" />
			{/if}
		</div>
	</div>
	<div class="mt-2">
		<p class="text-white text-shadow-dark line-clamp-2 text-sm font-medium leading-none">{name}</p>
		<MediaDate value={date} />
	</div>
</button>

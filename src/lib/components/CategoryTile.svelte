<script lang="ts">
	import { IconCamera, IconMusic, IconFilm, IconGear } from './icons';

	export type Category = 'photo' | 'audio' | 'video' | 'admin';

	interface Props {
		category: Category;
		onclick?: () => void;
	}

	let { category, onclick }: Props = $props();

	const configs: Record<Category, { label: string; gradient: string }> = {
		photo: { label: 'Photos', gradient: 'from-blue-500 to-indigo-600' },
		audio: { label: 'Audio', gradient: 'from-purple-500 to-violet-600' },
		video: { label: 'Video', gradient: 'from-rose-500 to-orange-500' },
		admin: { label: 'Admin', gradient: 'from-slate-500 to-slate-700' }
	};

	const config = $derived(configs[category]);
</script>

<button class="group w-full text-left" {onclick}>
	<div
		class="bg-gradient-to-br {config.gradient} aspect-square w-full overflow-hidden rounded-lg transition-opacity group-hover:opacity-80 flex items-center justify-center"
	>
		{#if category === 'photo'}
			<IconCamera class="h-16 w-16 text-white/90" />
		{:else if category === 'audio'}
			<IconMusic class="h-16 w-16 text-white/90" />
		{:else if category === 'video'}
			<IconFilm class="h-16 w-16 text-white/90" />
		{:else}
			<IconGear class="h-16 w-16 text-white/90" />
		{/if}
	</div>
	<div class="mt-2">
		<p class="text-white text-shadow-dark line-clamp-2 text-sm font-medium leading-none">{config.label}</p>
	</div>
</button>

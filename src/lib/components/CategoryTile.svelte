<script lang="ts">
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
			<svg class="h-16 w-16 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
			</svg>
		{:else if category === 'audio'}
			<svg class="h-16 w-16 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
			</svg>
		{:else if category === 'video'}
			<svg class="h-16 w-16 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125V6.375m0 0A1.125 1.125 0 013.375 5.25h17.25a1.125 1.125 0 011.125 1.125M3.375 6.375v12m17.25-12v12a1.125 1.125 0 01-1.125 1.125M18 6.375v12m0-12H6m12 0h1.875c.621 0 1.125.504 1.125 1.125M6 6.375H4.125C3.504 6.375 3 6.879 3 7.5" />
			</svg>
		{:else}
			<svg class="h-16 w-16 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
		{/if}
	</div>
	<div class="mt-2">
		<p class="text-text-primary text-sm font-medium">{config.label}</p>
	</div>
</button>

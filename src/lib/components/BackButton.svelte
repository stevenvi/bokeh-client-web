<script lang="ts">
	interface Props {
		onclick: (e: MouseEvent) => void;
	}
	let { onclick }: Props = $props();
</script>

<button
	class="text-white/80 hover:text-white flex items-center gap-2 text-sm transition-colors"
	{onclick}
	aria-label="Back"
>
	<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
	</svg>
	Back
</button>

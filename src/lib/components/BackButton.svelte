<script lang="ts">
	import { IconArrowLeft } from './icons';

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
	<IconArrowLeft class="h-5 w-5" />
	Back
</button>

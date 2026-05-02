<script lang="ts">
	interface Props {
		value: string;
		placeholder?: string;
		loading?: boolean;
		onDebouncedChange?: (q: string) => void;
	}

	let {
		value = $bindable(),
		placeholder = 'Search...',
		loading = false,
		onDebouncedChange
	}: Props = $props();

	let debounceTimer: ReturnType<typeof setTimeout>;

	function onInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		value = v;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			onDebouncedChange?.(v);
		}, 1500);
	}
</script>

<div
	class="bg-surface-raised text-text-primary placeholder-text-secondary border-border focus-within:border-accent relative w-full rounded-lg border"
>
	{#if loading}
		<div
			class="border-accent absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-t-transparent"
		></div>
	{/if}
	<input
		type="text"
		{placeholder}
		{value}
		oninput={onInput}
		class="w-full bg-transparent px-4 py-2 pl-10 text-sm focus:outline-none"
	/>
</div>

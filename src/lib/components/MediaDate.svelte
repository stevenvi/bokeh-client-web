<script lang="ts">
	interface Props { value: string | null | undefined; }
	let { value }: Props = $props();
</script>

{#if value}
	<p class="text-text-dim text-shadow-dark truncate text-xs">{value}</p>
{/if}

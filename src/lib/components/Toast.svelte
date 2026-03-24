<script lang="ts">
	interface Props {
		message: string;
		visible: boolean;
	}

	let { message, visible }: Props = $props();
</script>

{#if visible}
	<div
		class="bg-surface border-border text-text-primary fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-3 text-sm shadow-lg transition-opacity"
		role="status"
		aria-live="polite"
	>
		{message}
	</div>
{/if}

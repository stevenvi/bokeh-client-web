<script lang="ts">
	interface Props {
		collectionName: string;
		collectionType: string;
	}

	let { collectionName, collectionType }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center px-4 py-24 text-center">
	<svg class="text-text-muted mb-4 h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
	</svg>
	<h2 class="text-text-primary mb-2 text-xl font-semibold">{collectionName}</h2>
	<p class="text-text-muted text-sm">
		This content type (<code class="text-text-secondary">{collectionType}</code>) is not yet available.
	</p>
</div>

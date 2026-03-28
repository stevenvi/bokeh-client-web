<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigationStore } from '$lib/stores/navigation';

	function goHome() {
		navigationStore.reset();
		goto('/');
	}

	function goTo(id: number) {
		navigationStore.popTo(`/collection/${id}`);
		goto(`/collection/${id}`);
	}
</script>

<nav class="hidden items-center gap-1 px-4 py-3 md:flex" aria-label="Breadcrumb">
	<button
		class="text-text-muted hover:text-text-primary flex items-center gap-1 text-sm transition-colors"
		onclick={goHome}
	>
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
		</svg>
		Home
	</button>

	{#each $navigationStore as entry (entry.id)}
		<svg class="text-text-muted h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
		</svg>
		<button
			class="text-text-secondary hover:text-text-primary max-w-48 truncate text-sm transition-colors"
			onclick={() => goTo(entry.id)}
		>
			{entry.name}
		</button>
	{/each}
</nav>

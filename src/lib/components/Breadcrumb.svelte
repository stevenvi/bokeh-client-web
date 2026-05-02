<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigationStore } from '$lib/stores/navigation';
	import { IconHome, IconChevronRight } from './icons';

	function goHome() {
		navigationStore.snapshotForHistory();
		navigationStore.reset();
		goto('/');
	}

	function goTo(path: string) {
		navigationStore.snapshotForHistory();
		navigationStore.popTo(path);
		goto(path);
	}
</script>

<nav class="hidden items-center gap-1 px-4 py-3 md:flex" aria-label="Breadcrumb">
	<button
		class="text-text-secondary hover:text-text-primary flex items-center gap-1 text-sm transition-colors"
		onclick={goHome}
	>
		<IconHome class="h-4 w-4" />
		Home
	</button>

	{#each $navigationStore as entry (entry.id)}
		<IconChevronRight class="text-text-secondary h-4 w-4 flex-shrink-0" />
		<button
			class="text-text-secondary hover:text-text-primary max-w-48 truncate text-sm transition-colors"
			onclick={() => goTo(entry.path)}
		>
			{entry.name}
		</button>
	{/each}
</nav>

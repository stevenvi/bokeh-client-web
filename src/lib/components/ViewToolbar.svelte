<script lang="ts">
	type ViewMode = 'album' | 'waterfall';

	interface Props {
		mode: ViewMode;
		onModeChange: (mode: ViewMode) => void;
		onSlideshow: () => void;
	}

	let { mode, onModeChange, onSlideshow }: Props = $props();
</script>

<div class="flex items-center gap-1 px-4 py-2">
	<button
		class="rounded-lg p-2 transition-colors {mode === 'album' ? 'bg-surface-raised text-text-primary' : 'text-text-muted hover:text-text-primary'}"
		onclick={() => onModeChange('album')}
		title="Album view"
		aria-label="Album view"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
		</svg>
	</button>

	<button
		class="rounded-lg p-2 transition-colors {mode === 'waterfall' ? 'bg-surface-raised text-text-primary' : 'text-text-muted hover:text-text-primary'}"
		onclick={() => onModeChange('waterfall')}
		title="Timeline view"
		aria-label="Timeline view"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
		</svg>
	</button>

	<button
		class="text-text-muted hover:text-text-primary rounded-lg p-2 transition-colors"
		onclick={onSlideshow}
		title="Slideshow"
		aria-label="Start slideshow"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h12A2.25 2.25 0 0120.25 14.25V3m-16.5 0h16.5m-16.5 0H1.5m18.75 0H22.5M9 8.25l2.25 2.25L15 6.75" />
		</svg>
	</button>
</div>

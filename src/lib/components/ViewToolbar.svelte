<script lang="ts">
	import { IconGridView, IconWaterfallView, IconSlideshow } from './icons';

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
		<IconGridView class="h-5 w-5" />
	</button>

	<button
		class="rounded-lg p-2 transition-colors {mode === 'waterfall' ? 'bg-surface-raised text-text-primary' : 'text-text-muted hover:text-text-primary'}"
		onclick={() => onModeChange('waterfall')}
		title="Timeline view"
		aria-label="Timeline view"
	>
		<IconWaterfallView class="h-5 w-5" />
	</button>

	<button
		class="text-text-muted hover:text-text-primary rounded-lg p-2 transition-colors"
		onclick={onSlideshow}
		title="Slideshow"
		aria-label="Start slideshow"
	>
		<IconSlideshow class="h-5 w-5" />
	</button>
</div>

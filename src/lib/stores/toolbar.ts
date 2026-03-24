import { writable } from 'svelte/store';

export type ViewMode = 'album' | 'waterfall';

export interface ToolbarState {
	mode: ViewMode;
	onModeChange: (mode: ViewMode) => void;
	onSlideshow: () => void;
}

/** Set by PhotoAlbumView to project view-mode icons into the top bar. */
export const toolbarStore = writable<ToolbarState | null>(null);

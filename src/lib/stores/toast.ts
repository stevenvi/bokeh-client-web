import { writable } from 'svelte/store';

function createToastStore() {
	const { subscribe, set } = writable({ message: '', visible: false });
	let timer: ReturnType<typeof setTimeout> | null = null;
	return {
		subscribe,
		show(message: string, duration = 4000) {
			if (timer) clearTimeout(timer);
			set({ message, visible: true });
			timer = setTimeout(() => set({ message: '', visible: false }), duration);
		}
	};
}

export const toastStore = createToastStore();

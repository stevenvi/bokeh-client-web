import { writable } from 'svelte/store';

export type AppState = 'selecting-server' | 'logging-in' | 'authenticated';

export interface AppStore {
	state: AppState;
	serverUrl: string | null; // null = use relative URLs (same-origin via Vite proxy)
	isConnected: boolean;
}

const STORAGE_KEY = 'bokeh_server_url';

function createAppStore() {
	const savedUrl =
		typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

	const initial: AppStore = {
		state: savedUrl ? 'logging-in' : 'selecting-server',
		serverUrl: savedUrl,
		isConnected: true
	};

	const { subscribe, update } = writable<AppStore>(initial);

	return {
		subscribe,

		/** Store the server URL and transition to the login screen. */
		setServerUrl(url: string) {
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(STORAGE_KEY, url);
			}
			update((s) => ({ ...s, serverUrl: url, state: 'logging-in' }));
		},

		/** Mark the user as authenticated. */
		setAuthenticated() {
			update((s) => ({ ...s, state: 'authenticated' }));
		},

		/** Update the connection health state. */
		setConnected(connected: boolean) {
			update((s) => ({ ...s, isConnected: connected }));
		},

		/**
		 * Sign out: clear auth tokens (cookies cleared server-side via logout endpoint),
		 * but keep the server URL so the user goes back to the login screen.
		 */
		signOut() {
			update((s) => ({ ...s, state: 'logging-in' }));
		},

		/**
		 * Disconnect from server: return to server address selection.
		 * The server URL remains in localStorage for pre-population but the
		 * state reverts to selecting-server so the user must explicitly reconnect.
		 */
		disconnect() {
			update((s) => ({ ...s, state: 'selecting-server', serverUrl: null }));
		}
	};
}

export const appStore = createAppStore();

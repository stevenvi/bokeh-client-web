import { get } from 'svelte/store';

// Avoid circular import by lazily importing the store.
// The store module imports this file for apiFetch, so we read it at call time.
let _appStore: typeof import('$lib/stores/app').appStore | null = null;

async function getAppStore() {
	if (!_appStore) {
		const mod = await import('$lib/stores/app');
		_appStore = mod.appStore;
	}
	return _appStore;
}

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export async function apiFetch<T = void>(path: string, options: RequestInit = {}): Promise<T> {
	const store = await getAppStore();
	const { serverUrl } = get(store);
	const base = serverUrl ?? '';

	let res: Response;
	try {
		res = await fetch(`${base}${path}`, {
			...options,
			credentials: 'include', // always send httpOnly cookies
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			}
		});
	} catch {
		// Network failure (offline, server unreachable, etc.)
		store.setConnected(false);
		throw new ApiError(0, 'network_error', 'Network error — server unreachable');
	}

	// On successful response, restore connected state if it was lost.
	store.setConnected(true);

	if (!res.ok) {
		let message = res.statusText;
		try {
			const body = await res.json();
			message = body.message ?? message;
		} catch {
			// ignore parse errors
		}
		throw new ApiError(res.status, String(res.status), message);
	}

	if (res.status === 204) {
		return undefined as T;
	}
	return res.json() as Promise<T>;
}

/**
 * apiFetchText performs a GET and returns the plain-text body.
 * Used for endpoints like /api/v1/system/version.
 */
export async function apiFetchText(url: string): Promise<string> {
	let res: Response;
	try {
		res = await fetch(url, { credentials: 'include' });
	} catch {
		throw new ApiError(0, 'network_error', 'Network error — server unreachable');
	}
	if (!res.ok) {
		throw new ApiError(res.status, String(res.status), res.statusText);
	}
	return res.text();
}

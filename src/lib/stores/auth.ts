import { writable } from 'svelte/store';
import type { UserClaims } from '$lib/types';

const SESSION_KEY = 'bokeh_user_claims';

function loadFromSession(): UserClaims | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(SESSION_KEY);
		return raw ? (JSON.parse(raw) as UserClaims) : null;
	} catch {
		return null;
	}
}

function createAuthStore() {
	const { subscribe, set, update } = writable<UserClaims | null>(loadFromSession());

	return {
		subscribe,

		setClaims(claims: UserClaims) {
			if (typeof sessionStorage !== 'undefined') {
				sessionStorage.setItem(SESSION_KEY, JSON.stringify(claims));
			}
			set(claims);
		},

		updateExpiry(expiresInSeconds: number) {
			const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
			update((c) => (c ? { ...c, expiresAt } : c));
			if (typeof sessionStorage !== 'undefined') {
				const raw = sessionStorage.getItem(SESSION_KEY);
				if (raw) {
					try {
						const parsed = JSON.parse(raw) as UserClaims;
						sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...parsed, expiresAt }));
					} catch {
						// ignore
					}
				}
			}
		},

		clearClaims() {
			if (typeof sessionStorage !== 'undefined') {
				sessionStorage.removeItem(SESSION_KEY);
			}
			set(null);
		}
	};
}

export const authStore = createAuthStore();

/**
 * Decode the payload of a JWT without verifying the signature.
 * Only used once at login to extract userId, deviceId, isAdmin from the
 * access_token returned in the response body.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) return null;
		const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const padded = payload + '=='.slice((payload.length % 4) || 4);
		return JSON.parse(atob(padded)) as Record<string, unknown>;
	} catch {
		return null;
	}
}

/**
 * Extract UserClaims from a raw JWT string.
 * Returns null if the token is malformed.
 */
export function claimsFromToken(token: string, expiresInSeconds: number): UserClaims | null {
	const payload = decodeJwtPayload(token);
	if (!payload) return null;

	const userId = typeof payload.sub === 'string' ? parseInt(payload.sub, 10) : 0;
	const deviceId = typeof payload.did === 'number' ? payload.did : 0;
	const isAdmin = payload.adm === true;
	const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

	if (!userId || !deviceId) return null;
	return { userId, deviceId, isAdmin, expiresAt };
}

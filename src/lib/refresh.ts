import { refresh } from '$lib/api/auth';
import { authStore } from '$lib/stores/auth';
import { appStore } from '$lib/stores/app';
import { getOrCreateDeviceUUID } from '$lib/utils/deviceName';

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedule a proactive token refresh at 2/3 of the token's remaining lifetime.
 * If expiresInSeconds is null, the refresh is triggered immediately (e.g. on
 * page reload when the exact expiry is unknown).
 */
export function scheduleRefresh(expiresInSeconds: number | null): void {
	if (refreshTimer !== null) {
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}

	const delay =
		expiresInSeconds !== null
			? Math.floor(expiresInSeconds * (2 / 3)) * 1000
			: 0;

	refreshTimer = setTimeout(doRefresh, delay);
}

/** Cancel any pending refresh (e.g. on logout). */
export function cancelRefresh(): void {
	if (refreshTimer !== null) {
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}
}

async function doRefresh(): Promise<void> {
	refreshTimer = null;
	const deviceUUID = getOrCreateDeviceUUID();

	try {
		const res = await refresh(deviceUUID);
		authStore.updateExpiry(res.access_token_expires_in);
		scheduleRefresh(res.access_token_expires_in);
	} catch {
		// Refresh failed — sign out the user so they can re-authenticate.
		appStore.signOut();
		authStore.clearClaims();
	}
}

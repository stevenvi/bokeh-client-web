/**
 * Derive a human-readable device name from the browser environment.
 * Used as device_name on login so the device list is recognisable.
 */
export function deriveDeviceName(): string {
	if (typeof navigator === 'undefined') return 'Unknown Device';

	const ua = navigator.userAgent;

	// Detect OS
	let os = 'Unknown OS';
	if (/iPhone/.test(ua)) os = 'iPhone';
	else if (/iPad/.test(ua)) os = 'iPad';
	else if (/Android/.test(ua)) {
		const match = ua.match(/Android ([0-9.]+)/);
		os = match ? `Android ${match[1]}` : 'Android';
	} else if (/Macintosh|Mac OS X/.test(ua)) os = 'macOS';
	else if (/Windows NT/.test(ua)) {
		const match = ua.match(/Windows NT ([0-9.]+)/);
		const versions: Record<string, string> = {
			'10.0': '10/11',
			'6.3': '8.1',
			'6.2': '8',
			'6.1': '7'
		};
		os = `Windows ${versions[match?.[1] ?? ''] ?? (match?.[1] ?? '')}`;
	} else if (/Linux/.test(ua)) os = 'Linux';

	// Detect browser
	let browser = 'Unknown Browser';
	if (/Edg\//.test(ua)) browser = 'Edge';
	else if (/OPR\/|Opera\//.test(ua)) browser = 'Opera';
	else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
	else if (/Firefox\//.test(ua)) browser = 'Firefox';
	else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
	else if (/Chromium\//.test(ua)) browser = 'Chromium';

	return `${browser} on ${os}`;
}

/**
 * Generate a UUID v4, falling back to Math.random() outside secure contexts
 * where crypto.randomUUID() is unavailable.
 */
function generateUUID(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	// Fallback for non-secure contexts (HTTP on LAN)
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
	});
}

/**
 * Get or generate a persistent device UUID stored in localStorage.
 * The UUID identifies this browser installation uniquely.
 */
export function getOrCreateDeviceUUID(): string {
	const KEY = 'bokeh_device_uuid';
	if (typeof localStorage === 'undefined') return generateUUID();

	let uuid = localStorage.getItem(KEY);
	if (!uuid) {
		uuid = generateUUID();
		localStorage.setItem(KEY, uuid);
	}
	return uuid;
}

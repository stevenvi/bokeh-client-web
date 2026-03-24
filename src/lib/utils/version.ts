export const CLIENT_VERSION = '0.0.0';

/**
 * Check if the server version is compatible with this client.
 * Returns a warning message if incompatible, or null if compatible.
 *
 * Compatibility rules:
 * - Patch differences (0.0.X) are always compatible.
 * - Major or minor differences may indicate breaking changes.
 */
export function checkVersionCompatibility(serverVersion: string): string | null {
	const parseVersion = (v: string): [number, number, number] => {
		const parts = v.split('.').map(Number);
		return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
	};

	const [sMaj, sMin] = parseVersion(serverVersion.trim());
	const [cMaj, cMin] = parseVersion(CLIENT_VERSION);

	if (sMaj !== cMaj || sMin !== cMin) {
		return `Server version ${serverVersion} may not be compatible with client version ${CLIENT_VERSION}. The server administrator may need to update the client.`;
	}

	return null;
}

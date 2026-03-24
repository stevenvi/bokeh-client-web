import { apiFetch } from './client';
import type { DeviceView } from '$lib/types';

export interface LoginResponse {
	access_token: string; // one-time use: client decodes claims then discards
	access_token_expires_in: number;
	refresh_token: string;
	refresh_token_expires_in: number;
	device_id: number;
}

export interface RefreshResponse {
	access_token: string;
	access_token_expires_in: number;
	refresh_token: string;
	refresh_token_expires_in: number;
	device_id: number;
}

export interface MeResponse {
	id: number;
	name: string;
	is_admin: boolean;
	device_id: number;
}

export function login(
	credentials: { username: string; password: string },
	deviceUUID: string,
	deviceName: string
): Promise<LoginResponse> {
	return apiFetch<LoginResponse>('/api/v1/auth/login', {
		method: 'POST',
		body: JSON.stringify({
			provider: 'local',
			credentials,
			device_uuid: deviceUUID,
			device_name: deviceName
		})
	});
}

export function logout(): Promise<void> {
	return apiFetch<void>('/api/v1/auth/logout', { method: 'POST' });
}

export function refresh(deviceUUID: string): Promise<RefreshResponse> {
	// Cookies are sent automatically by the browser (credentials: 'include').
	// We still pass device_uuid in the body for server-side theft detection.
	return apiFetch<RefreshResponse>('/api/v1/auth/refresh', {
		method: 'POST',
		body: JSON.stringify({ device_uuid: deviceUUID })
	});
}

export function getMe(): Promise<MeResponse> {
	return apiFetch<MeResponse>('/api/v1/auth/me');
}

export function changePassword(password: string): Promise<void> {
	return apiFetch<void>('/api/v1/auth/credentials', {
		method: 'POST',
		body: JSON.stringify({ credentials: { password } })
	});
}

export function listDevices(): Promise<DeviceView[]> {
	return apiFetch<DeviceView[]>('/api/v1/auth/devices');
}

export function deleteDevice(id: number): Promise<void> {
	return apiFetch<void>(`/api/v1/auth/devices/${id}`, { method: 'DELETE' });
}

export function banDevice(id: number): Promise<void> {
	return apiFetch<void>(`/api/v1/auth/devices/${id}/ban`, { method: 'POST' });
}

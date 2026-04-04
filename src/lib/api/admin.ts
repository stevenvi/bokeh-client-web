import { apiFetch, apiFetchForm } from './client';
import type { AdminCollection, AdminUser, Job } from '$lib/types';

// ── Collections ───────────────────────────────────────────────────────────────

export function adminListCollections(): Promise<AdminCollection[]> {
	return apiFetch<AdminCollection[]>('/api/v1/admin/collections');
}

export function adminCreateCollection(
	name: string,
	type: string,
	relativePath: string
): Promise<{ id: number; scan_job_id: number }> {
	return apiFetch<{ id: number; scan_job_id: number }>('/api/v1/admin/collections', {
		method: 'POST',
		body: JSON.stringify({ name, type, relative_path: relativePath })
	});
}

export function adminDeleteCollection(id: number): Promise<void> {
	return apiFetch<void>(`/api/v1/admin/collections/${id}`, { method: 'DELETE' });
}

export function adminTriggerScan(id: number, force = false): Promise<{ job_id: number }> {
	const qs = force ? '?force=true' : '';
	return apiFetch<{ job_id: number }>(`/api/v1/admin/collections/${id}/scan${qs}`, {
		method: 'POST'
	});
}

export function adminUploadCollectionCover(id: number, file: File): Promise<void> {
	const form = new FormData();
	form.append('cover', file);
	return apiFetchForm<void>(`/api/v1/admin/collections/${id}/cover`, form);
}

export function adminUploadVideoCover(id: number, file: File): Promise<void> {
	const form = new FormData();
	form.append('cover', file);
	return apiFetchForm<void>(`/api/v1/admin/media/${id}/cover`, form);
}

export function adminUploadArtistImage(id: number, file: File): Promise<void> {
	const form = new FormData();
	form.append('image', file);
	return apiFetchForm<void>(`/api/v1/admin/artists/${id}/image`, form);
}

export function adminDeleteDerivatives(id: number): Promise<{ deleted: number }> {
	return apiFetch<{ deleted: number }>(`/api/v1/admin/collections/${id}/derivatives`, {
		method: 'DELETE'
	});
}

export function adminListCollectionUsers(id: number): Promise<number[]> {
	return apiFetch<number[]>(`/api/v1/admin/collections/${id}/users`);
}

export function adminSetCollectionUsers(id: number, userIds: number[]): Promise<void> {
	return apiFetch<void>(`/api/v1/admin/collections/${id}/users`, {
		method: 'POST',
		body: JSON.stringify({ user_ids: userIds })
	});
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function adminListUsers(): Promise<AdminUser[]> {
	return apiFetch<AdminUser[]>('/api/v1/admin/users');
}

export function adminCreateUser(
	name: string,
	password: string,
	isAdmin: boolean,
	localAccessOnly: boolean
): Promise<{ id: number }> {
	return apiFetch<{ id: number }>('/api/v1/admin/users', {
		method: 'POST',
		body: JSON.stringify({
			name,
			is_admin: isAdmin,
			local_access_only: localAccessOnly,
			auth_provider: 'local',
			credentials: { password }
		})
	});
}

export function adminDeleteUser(id: number): Promise<void> {
	return apiFetch<void>(`/api/v1/admin/users/${id}`, { method: 'DELETE' });
}

export function adminChangeUserPassword(id: number, password: string): Promise<void> {
	return apiFetch<void>(`/api/v1/admin/users/${id}/credentials`, {
		method: 'POST',
		body: JSON.stringify({ credentials: { password } })
	});
}

export function adminListUserDevices(userId: number): Promise<import('$lib/types').DeviceView[]> {
	return apiFetch(`/api/v1/admin/users/${userId}/devices`);
}

export function adminRevokeAllUserDevices(userId: number): Promise<void> {
	return apiFetch<void>(`/api/v1/admin/users/${userId}/devices`, { method: 'DELETE' });
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export function adminGetJob(id: number): Promise<Job> {
	return apiFetch<Job>(`/api/v1/admin/jobs/${id}`);
}

// ── Filesystem ────────────────────────────────────────────────────────────────

export type DirectoryEntry = { name: string; type: string };

export function adminListDirectories(path: string): Promise<DirectoryEntry[]> {
	const url = path
		? `/api/v1/admin/directories/${path.split('/').map(encodeURIComponent).join('/')}`
		: '/api/v1/admin/directories';
	return apiFetch<DirectoryEntry[]>(url);
}

// ── Maintenance ───────────────────────────────────────────────────────────────

export function adminOrphanCleanup(): Promise<{ job_id: number }> {
	return apiFetch<{ job_id: number }>('/api/v1/admin/maintenance/orphan-cleanup', {
		method: 'POST'
	});
}

export function adminIntegrityCheck(): Promise<{ job_id: number }> {
	return apiFetch<{ job_id: number }>('/api/v1/admin/maintenance/integrity-check', {
		method: 'POST'
	});
}

export function adminDeviceCleanup(): Promise<{ job_id: number }> {
	return apiFetch<{ job_id: number }>('/api/v1/admin/maintenance/device-cleanup', {
		method: 'POST'
	});
}

export function adminCoverCycle(): Promise<{ job_id: number }> {
	return apiFetch<{ job_id: number }>('/api/v1/admin/maintenance/cover-cycle', {
		method: 'POST'
	});
}

<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { authStore } from '$lib/stores/auth';
	import {
		adminListCollections,
		adminCreateCollection,
		adminDeleteCollection,
		adminTriggerScan,
		adminListCollectionUsers,
		adminSetCollectionUsers,
		adminListUsers,
		adminCreateUser,
		adminDeleteUser,
		adminOrphanCleanup,
		adminIntegrityCheck,
		adminDeviceCleanup,
		adminDeleteDerivatives,
		adminCoverCycle
	} from '$lib/api/admin';
	import { collectionCoverUrl } from '$lib/api/media';
	import ConfirmPopup from '$lib/components/ConfirmPopup.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import type { AdminCollection } from '$lib/types';

	const queryClient = useQueryClient();

	// Redirect non-admins
	onMount(() => {
		if (!$authStore?.isAdmin) {
			goto('/');
		}
	});

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			history.back();
		}
	}

	let toastMessage = $state('');
	let toastVisible = $state(false);
	function showToast(msg: string) {
		toastMessage = msg;
		toastVisible = true;
		setTimeout(() => (toastVisible = false), 4000);
	}

	// ── Queries ────────────────────────────────────────────────────────────────
	const collectionsQuery = createQuery({
		queryKey: ['admin-collections'],
		queryFn: adminListCollections
	});

	const usersQuery = createQuery({
		queryKey: ['admin-users'],
		queryFn: adminListUsers
	});

	// ── Create Collection ──────────────────────────────────────────────────────
	let showCreateCollection = $state(false);
	let newCollName = $state('');
	let newCollPath = $state('');
	let newCollType = $state('image:photo');
	let createCollError = $state('');
	let createCollLoading = $state(false);

	async function handleCreateCollection() {
		createCollError = '';
		if (!newCollName.trim() || !newCollPath.trim()) {
			createCollError = 'Name and path are required.';
			return;
		}
		createCollLoading = true;
		try {
			const res = await adminCreateCollection(newCollName.trim(), newCollType, newCollPath.trim());
			showToast(`Collection created (ID: ${res.id}). Scan job #${res.scan_job_id} queued.`);
			newCollName = '';
			newCollPath = '';
			newCollType = 'image:photo';
			showCreateCollection = false;
			queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
		} catch (e: unknown) {
			createCollError = e instanceof Error ? e.message : 'Failed to create collection.';
		} finally {
			createCollLoading = false;
		}
	}

	// ── Collection actions popup ───────────────────────────────────────────────
	let selectedCollection: AdminCollection | null = $state(null);
	let showCollectionActions = $state(false);
	let confirmDeleteCollection: AdminCollection | null = $state(null);

	async function handleRescan() {
		if (!selectedCollection) return;
		try {
			const res = await adminTriggerScan(selectedCollection.id);
			showToast(`Scan job #${res.job_id} queued.`);
			showCollectionActions = false;
		} catch (e: unknown) {
			showToast(e instanceof Error ? e.message : 'Failed to trigger scan.');
		}
	}

	let refreshMetadataLoading = $state(false);

	async function handleRefreshMetadata() {
		if (!selectedCollection) return;
		refreshMetadataLoading = true;
		try {
			const res = await adminTriggerScan(selectedCollection.id, true);
			showToast(`Metadata refresh job #${res.job_id} queued (force rescan).`);
			showCollectionActions = false;
		} catch (e: unknown) {
			showToast(e instanceof Error ? e.message : 'Failed to trigger metadata refresh.');
		} finally {
			refreshMetadataLoading = false;
		}
	}

	async function handleDeleteCollection() {
		if (!confirmDeleteCollection) return;
		try {
			await adminDeleteCollection(confirmDeleteCollection.id);
			showToast('Collection deleted.');
			queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
		} catch (e: unknown) {
			showToast(e instanceof Error ? e.message : 'Failed to delete collection.');
		} finally {
			confirmDeleteCollection = null;
			showCollectionActions = false;
		}
	}

	// ── Grant access popup ─────────────────────────────────────────────────────
	let showGrantAccess = $state(false);
	let grantAccessCollection: AdminCollection | null = $state(null);
	let grantAccessCurrentIds = $state<number[]>([]);
	let grantAccessSelected = $state<Set<number>>(new Set());
	let grantAccessLoading = $state(false);

	async function openGrantAccess(collection: AdminCollection) {
		grantAccessCollection = collection;
		showGrantAccess = true;
		showCollectionActions = false;
		try {
			grantAccessCurrentIds = await adminListCollectionUsers(collection.id);
			grantAccessSelected = new Set(grantAccessCurrentIds);
		} catch {
			grantAccessSelected = new Set();
		}
	}

	function toggleUser(userId: number) {
		const next = new Set(grantAccessSelected);
		if (next.has(userId)) next.delete(userId);
		else next.add(userId);
		grantAccessSelected = next;
	}

	async function saveGrantAccess() {
		if (!grantAccessCollection) return;
		grantAccessLoading = true;
		try {
			await adminSetCollectionUsers(grantAccessCollection.id, [...grantAccessSelected]);
			showToast('Access permissions saved.');
			showGrantAccess = false;
		} catch (e: unknown) {
			showToast(e instanceof Error ? e.message : 'Failed to save permissions.');
		} finally {
			grantAccessLoading = false;
		}
	}

	// ── Create User ────────────────────────────────────────────────────────────
	let showCreateUser = $state(false);
	let newUserName = $state('');
	let newUserPassword = $state('');
	let newUserIsAdmin = $state(false);
	let createUserError = $state('');
	let createUserLoading = $state(false);

	async function handleCreateUser() {
		createUserError = '';
		if (!newUserName.trim() || !newUserPassword.trim()) {
			createUserError = 'Username and password are required.';
			return;
		}
		createUserLoading = true;
		try {
			const res = await adminCreateUser(newUserName.trim(), newUserPassword, newUserIsAdmin);
			showToast(`User created (ID: ${res.id}).`);
			newUserName = '';
			newUserPassword = '';
			newUserIsAdmin = false;
			showCreateUser = false;
			queryClient.invalidateQueries({ queryKey: ['admin-users'] });
		} catch (e: unknown) {
			createUserError = e instanceof Error ? e.message : 'Failed to create user.';
		} finally {
			createUserLoading = false;
		}
	}

	// ── Delete User ────────────────────────────────────────────────────────────
	let confirmDeleteUserId: number | null = $state(null);
	let confirmDeleteUserName = $state('');

	async function handleDeleteUser() {
		if (confirmDeleteUserId === null) return;
		try {
			await adminDeleteUser(confirmDeleteUserId);
			showToast('User deleted.');
			queryClient.invalidateQueries({ queryKey: ['admin-users'] });
		} catch (e: unknown) {
			showToast(e instanceof Error ? e.message : 'Failed to delete user.');
		} finally {
			confirmDeleteUserId = null;
		}
	}

	// ── Maintenance ────────────────────────────────────────────────────────────
	async function runMaintenance(fn: () => Promise<{ job_id: number }>, label: string) {
		try {
			const res = await fn();
			showToast(`${label} queued as job #${res.job_id}.`);
		} catch (e: unknown) {
			showToast(e instanceof Error ? e.message : `Failed to run ${label}.`);
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<svelte:head>
	<title>Admin Dashboard — Bokeh</title>
</svelte:head>

<main class="bg-bg min-h-dvh px-4 py-6">

	<!-- ── Collection Management ─────────────────────────────────── -->
	<section class="bg-surface mb-8 rounded-xl p-6">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-text-primary text-lg font-semibold">Collections</h2>
			<button
				class="bg-accent hover:bg-accent-hover rounded-lg px-3 py-1.5 text-sm font-medium text-white"
				onclick={() => (showCreateCollection = true)}
			>
				+ Create Collection
			</button>
		</div>

		{#if $collectionsQuery.isPending}
			<p class="text-text-muted">Loading…</p>
		{:else if $collectionsQuery.isError}
			<p class="text-error">Failed to load collections.</p>
		{:else}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
				{#each $collectionsQuery.data ?? [] as coll (coll.id)}
					<button
						class="bg-surface-raised border-border rounded-lg border p-3 text-left transition hover:border-accent"
						onclick={() => { selectedCollection = coll; showCollectionActions = true; }}
					>
						<img
							src={collectionCoverUrl(coll.id)}
							alt=""
							class="bg-border mb-2 aspect-square w-full rounded object-cover"
							onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
						/>
						<p class="text-text-primary truncate text-sm font-medium">{coll.name}</p>
						<p class="text-text-muted text-xs">{coll.type}</p>
					</button>
				{/each}
			</div>
		{/if}
	</section>

	<!-- ── User Management ───────────────────────────────────────── -->
	<section class="bg-surface mb-8 rounded-xl p-6">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-text-primary text-lg font-semibold">Users</h2>
			<button
				class="bg-accent hover:bg-accent-hover rounded-lg px-3 py-1.5 text-sm font-medium text-white"
				onclick={() => (showCreateUser = true)}
			>
				+ Create User
			</button>
		</div>

		{#if $usersQuery.isPending}
			<p class="text-text-muted">Loading…</p>
		{:else if $usersQuery.isError}
			<p class="text-error">Failed to load users.</p>
		{:else}
			<div class="space-y-2">
				{#each $usersQuery.data ?? [] as user (user.id)}
					<div class="bg-surface-raised border-border flex items-center justify-between rounded-lg border px-4 py-3">
						<p class="text-text-primary text-sm font-medium">{user.name}</p>
						<div class="flex gap-2">
							<button
								class="border-border text-text-muted hover:text-text-primary rounded border px-2 py-1 text-xs"
								onclick={() => showToast('Change password is not yet implemented.')}
							>
								Change Password
							</button>
							<button
								class="border-error text-error rounded border px-2 py-1 text-xs"
								onclick={() => {
									confirmDeleteUserId = user.id;
									confirmDeleteUserName = user.name;
								}}
							>
								Delete
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- ── Job Management ────────────────────────────────────────── -->
	<section class="bg-surface rounded-xl p-6">
		<h2 class="text-text-primary mb-4 text-lg font-semibold">Maintenance Jobs</h2>
		<div class="flex flex-wrap gap-3">
			<button
				class="bg-surface-raised border-border hover:border-accent rounded-lg border px-4 py-2 text-sm"
				onclick={() => runMaintenance(adminOrphanCleanup, 'Orphan Cleanup')}
			>
				Run Orphan Cleanup
			</button>
			<button
				class="bg-surface-raised border-border hover:border-accent rounded-lg border px-4 py-2 text-sm"
				onclick={() => runMaintenance(adminIntegrityCheck, 'Integrity Check')}
			>
				Run Integrity Check
			</button>
			<button
				class="bg-surface-raised border-border hover:border-accent rounded-lg border px-4 py-2 text-sm"
				onclick={() => runMaintenance(adminDeviceCleanup, 'Device Cleanup')}
			>
				Run Device Cleanup
			</button>
			<button
				class="bg-surface-raised border-border hover:border-accent rounded-lg border px-4 py-2 text-sm"
				onclick={() => runMaintenance(adminCoverCycle, 'Cover Cycle')}
			>
				Cycle Cover Images
			</button>
		</div>
		<p class="text-text-muted mt-4 text-sm">Job history is not yet available.</p>
	</section>
</main>

<!-- Create Collection Popup -->
{#if showCreateCollection}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
		<div class="bg-surface w-full max-w-md rounded-xl p-6">
			<h3 class="text-text-primary mb-4 text-lg font-semibold">Create Collection</h3>
			<form onsubmit={(e) => { e.preventDefault(); handleCreateCollection(); }} class="space-y-4">
				<div>
					<label for="coll-name" class="text-text-secondary mb-1 block text-sm">Name</label>
					<input
						id="coll-name"
						type="text"
						bind:value={newCollName}
						class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 focus:border-accent focus:outline-none"
					/>
				</div>
				<div>
					<label for="coll-path" class="text-text-secondary mb-1 block text-sm">Path (relative to media root)</label>
					<input
						id="coll-path"
						type="text"
						bind:value={newCollPath}
						placeholder="photos/family"
						class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 focus:border-accent focus:outline-none"
					/>
				</div>
				<div>
					<label for="coll-type" class="text-text-secondary mb-1 block text-sm">Type</label>
					<select
						id="coll-type"
						bind:value={newCollType}
						class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 focus:border-accent focus:outline-none"
					>
						<option value="image:photo">Photo Album</option>
						<option value="audio:music">Music Library</option>
					</select>
				</div>
				{#if createCollError}
					<p class="text-error text-sm">{createCollError}</p>
				{/if}
				<div class="flex gap-3 pt-2">
					<button
						type="button"
						class="border-border text-text-secondary flex-1 rounded-lg border px-4 py-2 text-sm"
						onclick={() => (showCreateCollection = false)}
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={createCollLoading}
						class="bg-accent hover:bg-accent-hover flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					>
						{createCollLoading ? 'Creating…' : 'Create'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Collection Actions Popup -->
{#if showCollectionActions && selectedCollection}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
		<div class="bg-surface w-full max-w-sm rounded-xl p-6">
			<h3 class="text-text-primary mb-4 text-lg font-semibold">{selectedCollection.name}</h3>
			<div class="space-y-2">
				<button
					class="border-border hover:border-accent w-full rounded-lg border px-4 py-3 text-left text-sm"
					onclick={handleRescan}
				>
					🔄 Rescan Library
				</button>
				<button
					class="border-border hover:border-accent w-full rounded-lg border px-4 py-3 text-left text-sm disabled:opacity-50"
					disabled={refreshMetadataLoading}
					onclick={handleRefreshMetadata}
				>
					🔃 Refresh Metadata
				</button>
				<button
					class="border-border hover:border-accent w-full rounded-lg border px-4 py-3 text-left text-sm"
					onclick={() => openGrantAccess(selectedCollection!)}
				>
					👥 Grant Access
				</button>
				<button
					class="border-error text-error w-full rounded-lg border px-4 py-3 text-left text-sm"
					onclick={() => { confirmDeleteCollection = selectedCollection; showCollectionActions = false; }}
				>
					🗑 Delete Collection
				</button>
			</div>
			<button
				class="text-text-muted mt-4 w-full text-sm"
				onclick={() => (showCollectionActions = false)}
			>
				Cancel
			</button>
		</div>
	</div>
{/if}

<!-- Grant Access Popup -->
{#if showGrantAccess && grantAccessCollection}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
		<div class="bg-surface flex h-full max-h-[600px] w-full max-w-sm flex-col rounded-xl p-6">
			<h3 class="text-text-primary mb-4 text-lg font-semibold">
				Grant Access — {grantAccessCollection.name}
			</h3>
			<div class="flex-1 overflow-y-auto space-y-2">
				{#each $usersQuery.data ?? [] as user (user.id)}
					<label class="bg-surface-raised border-border flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer">
						<input
							type="checkbox"
							checked={grantAccessSelected.has(user.id)}
							onchange={() => toggleUser(user.id)}
							class="accent-accent"
						/>
						<span class="text-text-primary text-sm">{user.name}</span>
					</label>
				{/each}
			</div>
			<div class="flex gap-3 pt-4">
				<button
					class="border-border text-text-secondary flex-1 rounded-lg border px-4 py-2 text-sm"
					onclick={() => (showGrantAccess = false)}
				>
					Cancel
				</button>
				<button
					class="bg-accent hover:bg-accent-hover flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					disabled={grantAccessLoading}
					onclick={saveGrantAccess}
				>
					{grantAccessLoading ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Create User Popup -->
{#if showCreateUser}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
		<div class="bg-surface w-full max-w-md rounded-xl p-6">
			<h3 class="text-text-primary mb-4 text-lg font-semibold">Create User</h3>
			<form onsubmit={(e) => { e.preventDefault(); handleCreateUser(); }} class="space-y-4">
				<div>
					<label for="new-user-name" class="text-text-secondary mb-1 block text-sm">Username</label>
					<input
						id="new-user-name"
						type="text"
						bind:value={newUserName}
						class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 focus:border-accent focus:outline-none"
					/>
				</div>
				<div>
					<label for="new-user-password" class="text-text-secondary mb-1 block text-sm">Password</label>
					<input
						id="new-user-password"
						type="password"
						bind:value={newUserPassword}
						class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 focus:border-accent focus:outline-none"
					/>
				</div>
				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={newUserIsAdmin} class="accent-accent" />
					<span class="text-text-secondary text-sm">Administrator</span>
				</label>
				{#if createUserError}
					<p class="text-error text-sm">{createUserError}</p>
				{/if}
				<div class="flex gap-3 pt-2">
					<button
						type="button"
						class="border-border text-text-secondary flex-1 rounded-lg border px-4 py-2 text-sm"
						onclick={() => (showCreateUser = false)}
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={createUserLoading}
						class="bg-accent hover:bg-accent-hover flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					>
						{createUserLoading ? 'Creating…' : 'Create User'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Collection Confirm -->
{#if confirmDeleteCollection}
	<ConfirmPopup
		title="Delete Collection"
		message="This will remove the collection from Bokeh. No files will be deleted from your media library. This action cannot be undone."
		confirmLabel="Delete"
		destructive={true}
		onConfirm={handleDeleteCollection}
		onCancel={() => (confirmDeleteCollection = null)}
	/>
{/if}

<!-- Delete User Confirm -->
{#if confirmDeleteUserId !== null}
	<ConfirmPopup
		title="Delete User"
		message={`Are you sure you want to delete user "${confirmDeleteUserName}"? This cannot be undone.`}
		confirmLabel="Delete User"
		destructive={true}
		onConfirm={handleDeleteUser}
		onCancel={() => (confirmDeleteUserId = null)}
	/>
{/if}

<Toast message={toastMessage} visible={toastVisible} />

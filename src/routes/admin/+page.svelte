<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { authStore } from '$lib/stores/auth';
	import {
		adminListCollections,
		adminCreateCollection,
		adminListUsers,
		adminCreateUser,
		adminDeleteUser,
		adminOrphanCleanup,
		adminIntegrityCheck,
		adminDeviceCleanup,
		adminCoverCycle,
		adminListCollectionUsers,
		adminSetCollectionUsers
	} from '$lib/api/admin';
	import type { AdminUser } from '$lib/types';
	import { collectionCoverUrl } from '$lib/api/media';
	import { coverBustStore } from '$lib/stores/coverBust';
	import { toastStore } from '$lib/stores/toast';
	import ConfirmPopup from '$lib/components/ConfirmPopup.svelte';
	import PathBrowser from '$lib/components/PathBrowser.svelte';
	import AdminCollectionMenu from '$lib/components/AdminCollectionMenu.svelte';

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
	let typeDropdownOpen = $state(false);
	let createCollError = $state('');
	let createCollLoading = $state(false);

	const collectionTypes = [
		{ value: 'image:photo', label: 'Photo Album' },
		{ value: 'video:movie', label: 'Movie Library' },
		{ value: 'video:home_movie', label: 'Home Movies' },
		{ value: 'audio:music', label: 'Music Library' },
		{ value: 'audio:radio', label: 'Radio Library' }
	] as const;

	function collTypeLabel(val: string) {
		return collectionTypes.find((t) => t.value === val)?.label ?? val;
	}

	$effect(() => {
		if (newCollPath) {
			const segments = newCollPath.split('/');
			newCollName = segments[segments.length - 1];
		}
	});

	async function handleCreateCollection() {
		createCollError = '';
		if (!newCollPath.trim()) {
			createCollError = 'Please select a directory.';
			return;
		}
		if (!newCollName.trim()) {
			createCollError = 'Name is required.';
			return;
		}
		createCollLoading = true;
		try {
			const name = newCollName.trim();
			const path = newCollPath.trim();
			const type = newCollType;
			const res = await adminCreateCollection(name, type, path);
			toastStore.show(`Collection created. Scan job #${res.scan_job_id} queued.`);
			newCollName = '';
			newCollPath = '';
			newCollType = 'image:photo';
			showCreateCollection = false;
			queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
			openGrantAccess(res.id, name);
		} catch (e: unknown) {
			createCollError = e instanceof Error ? e.message : 'Failed to create collection.'; // shown inline
		} finally {
			createCollLoading = false;
		}
	}

	// ── Grant Access (post-creation) ──────────────────────────────────────────
	let showGrantAccess = $state(false);
	let grantAccessCollectionId = $state<number | null>(null);
	let grantAccessCollectionName = $state('');
	let grantAccessUsers = $state<AdminUser[]>([]);
	let grantAccessSelected = $state<Set<number>>(new Set());
	let grantAccessLoading = $state(false);

	async function openGrantAccess(collId: number, collName: string) {
		grantAccessCollectionId = collId;
		grantAccessCollectionName = collName;
		grantAccessSelected = new Set();
		showGrantAccess = true;
		try {
			const [users, currentIds] = await Promise.all([
				adminListUsers(),
				adminListCollectionUsers(collId)
			]);
			grantAccessUsers = users;
			grantAccessSelected = new Set(currentIds);
		} catch {
			grantAccessUsers = [];
		}
	}

	function toggleGrantUser(userId: number) {
		const next = new Set(grantAccessSelected);
		if (next.has(userId)) next.delete(userId);
		else next.add(userId);
		grantAccessSelected = next;
	}

	async function saveGrantAccess() {
		if (grantAccessCollectionId === null) return;
		grantAccessLoading = true;
		try {
			await adminSetCollectionUsers(grantAccessCollectionId, [...grantAccessSelected]);
			toastStore.show('Access permissions saved.');
			showGrantAccess = false;
		} catch (e: unknown) {
			toastStore.show(e instanceof Error ? e.message : 'Failed to save permissions.');
		} finally {
			grantAccessLoading = false;
		}
	}

	// ── Create User ────────────────────────────────────────────────────────────
	let showCreateUser = $state(false);
	let newUserName = $state('');
	let newUserPassword = $state('');
	let newUserIsAdmin = $state(false);
	let newUserLocalAccessOnly = $state(false);
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
			const res = await adminCreateUser(newUserName.trim(), newUserPassword, newUserIsAdmin, newUserLocalAccessOnly);
			toastStore.show(`User created (ID: ${res.id}).`);
			newUserName = '';
			newUserPassword = '';
			newUserIsAdmin = false;
			newUserLocalAccessOnly = false;
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
			toastStore.show('User deleted.');
			queryClient.invalidateQueries({ queryKey: ['admin-users'] });
		} catch (e: unknown) {
			toastStore.show(e instanceof Error ? e.message : 'Failed to delete user.');
		} finally {
			confirmDeleteUserId = null;
		}
	}

	// ── Maintenance ────────────────────────────────────────────────────────────
	async function runMaintenance(fn: () => Promise<{ job_id: number }>, label: string) {
		try {
			const res = await fn();
			toastStore.show(`${label} queued as job #${res.job_id}.`);
		} catch (e: unknown) {
			toastStore.show(e instanceof Error ? e.message : `Failed to run ${label}.`);
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<svelte:head>
	<title>Admin Dashboard — Bokeh</title>
</svelte:head>

<main class="min-h-dvh px-4 py-6">

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
					<div class="relative">
						<div class="bg-surface-raised border-border rounded-lg border p-3">
							{#key $coverBustStore[coll.id]}
								<div class="relative mb-2 aspect-square w-full overflow-hidden rounded">
									<img
										src={collectionCoverUrl(coll.id) + ($coverBustStore[coll.id] ? `?v=${$coverBustStore[coll.id]}` : '')}
										alt=""
										class="absolute inset-0 h-full w-full object-cover"
										onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
									/>
									<div class="absolute inset-0 flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-raised to-border">
										{#if coll.type === 'image:photo'}
											<svg class="text-text-muted h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
											</svg>
										{:else if coll.type.startsWith('audio:')}
											<svg class="text-text-muted h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
											</svg>
										{:else if coll.type === 'video:movie'}
											<svg class="text-text-muted h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125V6.375m0 0A1.125 1.125 0 013.375 5.25h17.25a1.125 1.125 0 011.125 1.125M3.375 6.375v12m17.25-12v12a1.125 1.125 0 01-1.125 1.125M18 6.375v12" />
											</svg>
										{:else}
											<svg class="text-text-muted h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
											</svg>
										{/if}
									</div>
								</div>
							{/key}
							<p class="text-text-primary truncate text-sm font-medium">{coll.name}</p>
							<p class="text-text-muted text-xs">{coll.type}</p>
						</div>
						<div class="absolute top-2 right-2 z-10" onclick={(e) => e.stopPropagation()}>
							<AdminCollectionMenu collection={coll} />
						</div>
					</div>
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
								onclick={() => toastStore.show('Change password is not yet implemented.')}
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

{#snippet typeIcon(type: string)}
	{#if type === 'image:photo'}
		<!-- Landscape photograph -->
		<svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
			<rect x="2" y="3" width="20" height="18" rx="2"/>
			<circle cx="8.5" cy="9.5" r="1.5"/>
			<path d="M3 17 l4-4 3 3 4-4.5 7 5.5"/>
		</svg>
	{:else if type === 'video:movie'}
		<!-- Clapperboard -->
		<svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
			<rect x="3" y="4" width="18" height="4" rx="1"/>
			<rect x="3" y="8" width="18" height="12" rx="1"/>
			<line x1="7" y1="4" x2="6" y2="8"/>
			<line x1="12" y1="4" x2="11" y2="8"/>
			<line x1="17" y1="4" x2="16" y2="8"/>
		</svg>
	{:else if type === 'video:home_movie'}
		<!-- Film reel -->
		<svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="12" cy="12" r="9"/>
			<circle cx="12" cy="12" r="3"/>
			<line x1="12" y1="3" x2="12" y2="9"/>
			<line x1="12" y1="15" x2="12" y2="21"/>
			<line x1="3" y1="12" x2="9" y2="12"/>
			<line x1="15" y1="12" x2="21" y2="12"/>
		</svg>
	{:else if type === 'audio:music'}
		<!-- Music notes -->
		<svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
			<path d="M9 18V5l12-2v13"/>
			<circle cx="6" cy="18" r="3"/>
			<circle cx="18" cy="16" r="3"/>
		</svg>
	{:else if type === 'audio:radio'}
		<!-- Radio tower with signal arcs -->
		<svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
			<line x1="12" y1="2" x2="12" y2="13"/>
			<path d="M9 22 L12 13 L15 22"/>
			<path d="M8.5 9 Q12 5.5 15.5 9"/>
			<path d="M5.5 6.5 Q12 1 18.5 6.5"/>
		</svg>
	{/if}
{/snippet}

<!-- Create Collection Popup -->
{#if showCreateCollection}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
		<div class="bg-surface w-full max-w-xl rounded-xl p-6">
			<h3 class="text-text-primary mb-4 text-lg font-semibold">Create Collection</h3>
			<form onsubmit={(e) => { e.preventDefault(); handleCreateCollection(); }} class="space-y-4">
				<div>
					<label class="text-text-secondary mb-1 block text-sm">Directory</label>
					<PathBrowser bind:selectedPath={newCollPath} bind:selectedType={newCollType} />
				</div>
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
					<label class="text-text-secondary mb-1 block text-sm">Type</label>
					<div class="relative">
						<button
							type="button"
							onclick={() => (typeDropdownOpen = !typeDropdownOpen)}
							class="bg-surface-raised border-border text-text-primary flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left focus:border-accent focus:outline-none"
						>
							{@render typeIcon(newCollType)}
							<span class="flex-1 text-sm">{collTypeLabel(newCollType)}</span>
							<svg class="text-text-muted h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
							</svg>
						</button>
						{#if typeDropdownOpen}
							<div class="fixed inset-0 z-[9]" onclick={() => (typeDropdownOpen = false)}></div>
							<div class="bg-surface border-border absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border shadow-lg">
								{#each collectionTypes as ct}
									<button
										type="button"
										onclick={() => { newCollType = ct.value; typeDropdownOpen = false; }}
										class="flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-surface-raised {newCollType === ct.value ? 'bg-surface-raised text-text-primary' : 'text-text-secondary'}"
									>
										{@render typeIcon(ct.value)}
										{ct.label}
									</button>
								{/each}
							</div>
						{/if}
					</div>
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
				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={newUserLocalAccessOnly} class="accent-accent" />
					<span class="text-text-secondary text-sm">Only allow access on local network</span>
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

<!-- Grant Access (post-creation) -->
{#if showGrantAccess}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
		<div class="bg-surface flex h-full max-h-[600px] w-full max-w-sm flex-col rounded-xl p-6">
			<h3 class="text-text-primary mb-1 text-lg font-semibold">Grant Access</h3>
			<p class="text-text-secondary mb-4 text-sm">{grantAccessCollectionName}</p>
			<div class="flex-1 space-y-2 overflow-y-auto">
				{#each grantAccessUsers as user (user.id)}
					<label class="bg-surface-raised border-border flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3">
						<input
							type="checkbox"
							checked={grantAccessSelected.has(user.id)}
							onchange={() => toggleGrantUser(user.id)}
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
					Skip
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


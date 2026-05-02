<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { authStore } from '$lib/stores/auth';
	import {
		adminListCollections,
		adminCreateCollection,
		adminListUsers,
		adminCreateUser,
		adminDeleteUser,
		adminCreateJob,
		adminListJobs,
		adminListCollectionUsers,
		adminSetCollectionUsers,
		adminChangeUserPassword
	} from '$lib/api/admin';
	import type { AdminUser } from '$lib/types';
	import { collectionCoverUrl } from '$lib/api/media';
	import { coverBustStore } from '$lib/stores/coverBust';
	import { toastStore } from '$lib/stores/toast';
	import ConfirmPopup from '$lib/components/ConfirmPopup.svelte';
	import PathBrowser from '$lib/components/PathBrowser.svelte';
	import AdminCollectionMenu from '$lib/components/AdminCollectionMenu.svelte';
	import { useRootBreadcrumb } from '$lib/utils/breadcrumb.svelte';
	import {
		IconPhoto,
		IconMusic,
		IconFilm,
		IconFolderCollection,
		IconTypePhoto,
		IconTypeMovie,
		IconTypeHomeMovie,
		IconTypeMusic,
		IconTypeRadioShow,
		IconChevronDown,
		IconEye,
		IconEyeSlash
	} from '$lib/components/icons';

	const queryClient = useQueryClient();

	useRootBreadcrumb(() => ({ id: -100, name: 'Admin Dashboard', path: '/admin' }));

	// Redirect non-admins
	onMount(() => {
		if (!$authStore?.isAdmin) {
			goto('/');
		}
	});

	// ── Queries ────────────────────────────────────────────────────────────────
	let coverLoadedStates = $state<Record<number, boolean>>({});
	let coverErrorStates = $state<Record<number, boolean>>({});

	$effect.pre(() => {
		// Reset cover state when cache busts
		Object.keys($coverBustStore).forEach(id => {
			const numId = parseInt(id);
			coverLoadedStates[numId] = false;
			coverErrorStates[numId] = false;
		});
	});

	const collectionsQuery = createQuery({
		queryKey: ['admin-collections'],
		queryFn: adminListCollections
	});

	const usersQuery = createQuery({
		queryKey: ['admin-users'],
		queryFn: adminListUsers
	});

	const jobsQuery = createQuery({
		queryKey: ['admin-jobs'],
		queryFn: () => adminListJobs(),
		refetchInterval: 5000
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
		{ value: 'audio:show', label: 'Radio Shows' }
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

	// ── Change Password ────────────────────────────────────────────────────────
	let changePasswordUserId: number | null = $state(null);
	let changePasswordUserName = $state('');
	let changePasswordNew = $state('');
	let changePasswordConfirm = $state('');
	let changePasswordShowNew = $state(false);
	let changePasswordShowConfirm = $state(false);
	let changePasswordError = $state('');
	let changePasswordLoading = $state(false);

	function openChangePassword(userId: number, userName: string) {
		changePasswordUserId = userId;
		changePasswordUserName = userName;
		changePasswordNew = '';
		changePasswordConfirm = '';
		changePasswordShowNew = false;
		changePasswordShowConfirm = false;
		changePasswordError = '';
	}

	function closeChangePassword() {
		changePasswordUserId = null;
	}

	async function handleChangePassword() {
		changePasswordError = '';
		if (!changePasswordNew || !changePasswordConfirm) {
			changePasswordError = 'Please enter and confirm the new password.';
			return;
		}
		if (changePasswordNew !== changePasswordConfirm) {
			changePasswordError = 'Passwords do not match.';
			return;
		}
		if (changePasswordUserId === null) return;
		changePasswordLoading = true;
		try {
			await adminChangeUserPassword(changePasswordUserId, changePasswordNew);
			toastStore.show(`Password updated for ${changePasswordUserName}.`);
			closeChangePassword();
		} catch (e: unknown) {
			changePasswordError = e instanceof Error ? e.message : 'Failed to update password.';
		} finally {
			changePasswordLoading = false;
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

	// ── Sub-job progress easing ────────────────────────────────────────────────
	let displayedSubjobRatio = $state<Record<number, number>>({});
	const activeAnimations = new Map<number, number>();

	function easeOutCubic(t: number): number {
		return 1 - Math.pow(1 - t, 3);
	}

	function animateJobProgress(jobId: number, from: number, to: number, duration: number) {
		const existing = activeAnimations.get(jobId);
		if (existing !== undefined) cancelAnimationFrame(existing);

		const startTime = performance.now();
		function tick(now: number) {
			const t = Math.min((now - startTime) / duration, 1);
			displayedSubjobRatio[jobId] = from + (to - from) * easeOutCubic(t);
			if (t < 1) {
				activeAnimations.set(jobId, requestAnimationFrame(tick));
			} else {
				activeAnimations.delete(jobId);
			}
		}
		activeAnimations.set(jobId, requestAnimationFrame(tick));
	}

	$effect(() => {
		for (const job of $jobsQuery.data?.jobs ?? []) {
			if (job.supports_sub_jobs && job.total_sub_jobs > 0) {
				const target = job.subjobs_completed / job.total_sub_jobs;
				const current = displayedSubjobRatio[job.id] ?? 0;
				animateJobProgress(job.id, current, target, 5000);
			}
		}
	});

	onDestroy(() => {
		for (const handle of activeAnimations.values()) cancelAnimationFrame(handle);
	});

	// ── Maintenance ────────────────────────────────────────────────────────────
	async function runMaintenance(type: string, label: string) {
		try {
			const res = await adminCreateJob(type);
			toastStore.show(`${label} queued as job #${res.id}.`);
			queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
		} catch (e: unknown) {
			toastStore.show(e instanceof Error ? e.message : `Failed to run ${label}.`);
		}
	}
</script>

<svelte:head>
	<title>Admin Dashboard — Bokeh</title>
</svelte:head>

<main class="px-4 py-6">

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
			<p class="text-text-secondary">Loading…</p>
		{:else if $collectionsQuery.isError}
			<p class="text-error">Failed to load collections.</p>
		{:else}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
				{#each $collectionsQuery.data ?? [] as coll (coll.id)}
					<div class="relative">
						<div class="bg-surface-raised border-border rounded-lg border p-3">
							{#key $coverBustStore[coll.id]}
								<div class="relative mb-2 aspect-square w-full overflow-hidden rounded">
									{#if !coverErrorStates[coll.id]}
									<img
										src={collectionCoverUrl(coll.id) + ($coverBustStore[coll.id] ? `?v=${$coverBustStore[coll.id]}` : '')}
										alt=""
										class="absolute inset-0 h-full w-full object-cover"
										onload={() => { coverLoadedStates[coll.id] = true; }}
										onerror={() => { coverErrorStates[coll.id] = true; }}
									/>
								{/if}
									<div class="absolute inset-0 flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-raised to-border transition-opacity duration-300" class:opacity-0={coverLoadedStates[coll.id] && !coverErrorStates[coll.id]}>
										{#if coll.type === 'image:photo'}
											<IconPhoto class="text-text-muted h-6 w-6" />
										{:else if coll.type.startsWith('audio:')}
											<IconMusic class="text-text-muted h-6 w-6" />
										{:else if coll.type === 'video:movie'}
											<IconFilm class="text-text-muted h-6 w-6" />
										{:else}
											<IconFolderCollection class="text-text-muted h-6 w-6" />
										{/if}
									</div>
								</div>
							{/key}
							<p class="text-text-primary truncate text-sm font-medium">{coll.name}</p>
							<p class="text-text-secondary text-xs">{coll.type}</p>
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
			<p class="text-text-secondary">Loading…</p>
		{:else if $usersQuery.isError}
			<p class="text-error">Failed to load users.</p>
		{:else}
			<div class="space-y-2">
				{#each $usersQuery.data ?? [] as user (user.id)}
					<div class="bg-surface-raised border-border flex items-center justify-between rounded-lg border px-4 py-3">
						<p class="text-text-primary text-sm font-medium">{user.name}</p>
						<div class="flex gap-2">
							<button
								class="border-border text-text-secondary hover:text-text-primary rounded border px-2 py-1 text-xs"
								onclick={() => openChangePassword(user.id, user.name)}
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
	<section class="bg-surface mb-8 rounded-xl p-6">
		<h2 class="text-text-primary mb-4 text-lg font-semibold">Maintenance Jobs</h2>
		<div class="flex flex-wrap gap-3">
			<button
				class="bg-surface-raised border-border hover:border-accent rounded-lg border px-4 py-2 text-sm"
				onclick={() => runMaintenance('orphan_cleanup', 'Orphan Cleanup')}
			>
				Run Orphan Cleanup
			</button>
			<button
				class="bg-surface-raised border-border hover:border-accent rounded-lg border px-4 py-2 text-sm"
				onclick={() => runMaintenance('integrity_check', 'Integrity Check')}
			>
				Run Integrity Check
			</button>
			<button
				class="bg-surface-raised border-border hover:border-accent rounded-lg border px-4 py-2 text-sm"
				onclick={() => runMaintenance('device_cleanup', 'Device Cleanup')}
			>
				Run Device Cleanup
			</button>
			<button
				class="bg-surface-raised border-border hover:border-accent rounded-lg border px-4 py-2 text-sm"
				onclick={() => runMaintenance('cover_cycle', 'Cover Cycle')}
			>
				Cycle Cover Images
			</button>
		</div>
	</section>

	<!-- ── Jobs ──────────────────────────────────────────────────── -->
	<section class="bg-surface rounded-xl p-6">
		<h2 class="text-text-primary mb-4 text-lg font-semibold">Jobs</h2>

		{#if $jobsQuery.isPending}
			<p class="text-text-secondary text-sm">Loading…</p>
		{:else if $jobsQuery.isError}
			<p class="text-error text-sm">Failed to load jobs.</p>
		{:else}
			{@const jobs = [...($jobsQuery.data?.jobs ?? [])].reverse()}
			{#if jobs.length === 0}
				<p class="text-text-secondary text-sm">No jobs.</p>
			{:else}
				<div class="space-y-2">
					{#each jobs as job (job.id)}
						<div class="bg-surface-raised border-border rounded-lg border px-4 py-3">
							<div class="flex items-center justify-between gap-4">
								<div class="min-w-0">
									<span class="text-text-primary text-sm font-medium">{job.type}</span>
									{#if job.related_name}
										<span class="text-text-secondary text-sm"> — {job.related_name}</span>
									{/if}
								</div>
								<span class="text-xs font-medium shrink-0 rounded px-2 py-0.5
									{job.status === 'running' ? 'bg-accent/20 text-accent' :
									 job.status === 'done' ? 'bg-green-500/20 text-green-400' :
									 job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
									 'bg-surface text-text-secondary border border-border'}"
								>
									{job.status}
								</span>
							</div>
							{#if job.status === 'running' && job.total_steps > 1}
								<div class="mt-2">
									<div class="bg-border h-1 w-full overflow-hidden rounded-full">
										<div
											class="bg-accent h-full rounded-full transition-all"
											style="width: {Math.round(((job.step - 1) / job.total_steps) * 100)}%"
										></div>
									</div>
								</div>
							{/if}
							{#if job.supports_sub_jobs && job.total_sub_jobs > 0}
								<div class="mt-2">
									<div class="bg-border h-1 w-full overflow-hidden rounded-full">
										<div
											class="bg-accent h-full rounded-full"
											style="width: {((displayedSubjobRatio[job.id] ?? 0) * 100).toFixed(2)}%"
										></div>
									</div>
									<p class="text-text-secondary mt-1 text-xs">{Math.round((displayedSubjobRatio[job.id] ?? 0) * job.total_sub_jobs)} / {job.total_sub_jobs}</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>
				{#if ($jobsQuery.data?.total ?? 0) > jobs.length}
					<p class="text-text-secondary mt-3 text-xs">{$jobsQuery.data?.total} total jobs — showing most recent {jobs.length}</p>
				{/if}
			{/if}
		{/if}
	</section>
</main>

{#snippet typeIcon(type: string)}
	{#if type === 'image:photo'}
		<IconTypePhoto class="h-4 w-4 flex-shrink-0" />
	{:else if type === 'video:movie'}
		<IconTypeMovie class="h-4 w-4 flex-shrink-0" />
	{:else if type === 'video:home_movie'}
		<IconTypeHomeMovie class="h-4 w-4 flex-shrink-0" />
	{:else if type === 'audio:music'}
		<IconTypeMusic class="h-4 w-4 flex-shrink-0" />
	{:else if type === 'audio:show'}
		<IconTypeRadioShow class="h-4 w-4 flex-shrink-0" />
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
							<IconChevronDown class="text-text-muted h-4 w-4 flex-shrink-0" />
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

<!-- Change Password Modal -->
{#if changePasswordUserId !== null}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
		<div class="bg-surface w-full max-w-md rounded-xl p-6">
			<h3 class="text-text-primary mb-1 text-lg font-semibold">Change Password</h3>
			<p class="text-text-secondary mb-4 text-sm">{changePasswordUserName}</p>
			<form onsubmit={(e) => { e.preventDefault(); handleChangePassword(); }} class="space-y-4">
				<div>
					<label for="cp-new" class="text-text-secondary mb-1 block text-sm">New Password</label>
					<div class="relative">
						{#if changePasswordShowNew}
							<input
								id="cp-new"
								type="text"
								bind:value={changePasswordNew}
								class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 pr-10 focus:border-accent focus:outline-none"
							/>
						{:else}
							<input
								id="cp-new"
								type="password"
								bind:value={changePasswordNew}
								class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 pr-10 focus:border-accent focus:outline-none"
							/>
						{/if}
						<button
							type="button"
							tabindex="-1"
							class="absolute inset-y-0 right-0 flex items-center px-2 text-text-muted hover:text-text-primary"
							aria-label={changePasswordShowNew ? 'Hide password' : 'Show password'}
							onclick={() => (changePasswordShowNew = !changePasswordShowNew)}
						>
							{#if changePasswordShowNew}
								<IconEye class="h-5 w-5" />
							{:else}
								<IconEyeSlash class="h-5 w-5" />
							{/if}
						</button>
					</div>
				</div>
				<div>
					<label for="cp-confirm" class="text-text-secondary mb-1 block text-sm">Confirm Password</label>
					<div class="relative">
						{#if changePasswordShowConfirm}
							<input
								id="cp-confirm"
								type="text"
								bind:value={changePasswordConfirm}
								class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 pr-10 focus:border-accent focus:outline-none"
							/>
						{:else}
							<input
								id="cp-confirm"
								type="password"
								bind:value={changePasswordConfirm}
								class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 pr-10 focus:border-accent focus:outline-none"
							/>
						{/if}
						<button
							type="button"
							tabindex="-1"
							class="absolute inset-y-0 right-0 flex items-center px-2 text-text-muted hover:text-text-primary"
							aria-label={changePasswordShowConfirm ? 'Hide password' : 'Show password'}
							onclick={() => (changePasswordShowConfirm = !changePasswordShowConfirm)}
						>
							{#if changePasswordShowConfirm}
								<IconEye class="h-5 w-5" />
							{:else}
								<IconEyeSlash class="h-5 w-5" />
							{/if}
						</button>
					</div>
				</div>
				{#if changePasswordError}
					<p class="text-error text-sm">{changePasswordError}</p>
				{/if}
				<div class="flex gap-3 pt-2">
					<button
						type="button"
						class="border-border text-text-secondary flex-1 rounded-lg border px-4 py-2 text-sm"
						onclick={closeChangePassword}
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={changePasswordLoading}
						class="bg-accent hover:bg-accent-hover flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					>
						{changePasswordLoading ? 'Updating…' : 'Update Password'}
					</button>
				</div>
			</form>
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


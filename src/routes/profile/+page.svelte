<script lang="ts">
	import { createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { listDevices, deleteDevice, banDevice, changePassword } from '$lib/api/auth';
	import { authStore } from '$lib/stores/auth';
	import ConfirmPopup from '$lib/components/ConfirmPopup.svelte';
	import Toast from '$lib/components/Toast.svelte';

	const queryClient = useQueryClient();

	const devicesQuery = createQuery({
		queryKey: ['devices'],
		queryFn: listDevices
	});

	let toastMessage = $state('');
	let toastVisible = $state(false);

	function showToast(msg: string) {
		toastMessage = msg;
		toastVisible = true;
		setTimeout(() => (toastVisible = false), 3000);
	}

	// Change password form
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let pwError = $state('');
	let pwLoading = $state(false);

	async function handleChangePassword() {
		pwError = '';
		if (newPassword !== confirmPassword) {
			pwError = 'New passwords do not match.';
			return;
		}
		if (newPassword.length < 1) {
			pwError = 'New password cannot be empty.';
			return;
		}
		pwLoading = true;
		try {
			// Server uses credentials: { password } for the local provider.
			// Note: changing password invalidates all other sessions on the server.
			await changePassword(newPassword);
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			showToast('Password changed. All other sessions have been invalidated.');
		} catch (e: unknown) {
			pwError = e instanceof Error ? e.message : 'Failed to change password.';
		} finally {
			pwLoading = false;
		}
	}

	// Device management
	let confirmDevice: { id: number; action: 'logout' | 'ban' } | null = $state(null);

	async function executeDeviceAction() {
		if (!confirmDevice) return;
		try {
			if (confirmDevice.action === 'logout') {
				await deleteDevice(confirmDevice.id);
				showToast('Device has been logged out.');
			} else {
				await banDevice(confirmDevice.id);
				showToast('Device has been banned.');
			}
			queryClient.invalidateQueries({ queryKey: ['devices'] });
		} catch (e: unknown) {
			showToast(e instanceof Error ? e.message : 'Action failed.');
		} finally {
			confirmDevice = null;
		}
	}
</script>

<svelte:head>
	<title>Profile — Bokeh</title>
</svelte:head>

<main class="bg-bg min-h-dvh px-4 py-6">
	<h1 class="text-text-primary mb-8 text-2xl font-semibold">Profile</h1>

	<!-- Change Password -->
	<section class="bg-surface mb-8 rounded-xl p-6">
		<h2 class="text-text-primary mb-4 text-lg font-semibold">Change Password</h2>

		<form onsubmit={(e) => { e.preventDefault(); handleChangePassword(); }} class="space-y-4 max-w-sm">
			<div>
				<label class="text-text-secondary mb-1 block text-sm" for="current-pw">Current Password</label>
				<input
					id="current-pw"
					type="password"
					bind:value={currentPassword}
					class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 focus:border-accent focus:outline-none"
					autocomplete="current-password"
				/>
			</div>
			<div>
				<label class="text-text-secondary mb-1 block text-sm" for="new-pw">New Password</label>
				<input
					id="new-pw"
					type="password"
					bind:value={newPassword}
					class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 focus:border-accent focus:outline-none"
					autocomplete="new-password"
				/>
			</div>
			<div>
				<label class="text-text-secondary mb-1 block text-sm" for="confirm-pw">Confirm New Password</label>
				<input
					id="confirm-pw"
					type="password"
					bind:value={confirmPassword}
					class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 focus:border-accent focus:outline-none"
					autocomplete="new-password"
				/>
			</div>
			<p class="text-text-muted text-xs">
				Note: changing your password will invalidate all other active sessions.
			</p>
			{#if pwError}
				<p class="text-error text-sm">{pwError}</p>
			{/if}
			<button
				type="submit"
				disabled={pwLoading}
				class="bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
			>
				{pwLoading ? 'Saving…' : 'Change Password'}
			</button>
		</form>
	</section>

	<!-- Device History -->
	<section class="bg-surface rounded-xl p-6">
		<h2 class="text-text-primary mb-4 text-lg font-semibold">Device History</h2>

		{#if $devicesQuery.isPending}
			<p class="text-text-muted">Loading devices…</p>
		{:else if $devicesQuery.isError}
			<p class="text-error">Failed to load devices.</p>
		{:else}
			{@const currentDeviceId = $authStore?.deviceId}
			{@const active = ($devicesQuery.data ?? []).filter((d) => !d.banned_at)}
			{@const banned = ($devicesQuery.data ?? []).filter((d) => d.banned_at)}

			{#if active.length > 0}
				<div class="mb-6 space-y-3">
					{#each active as device (device.id)}
						{@const isCurrent = device.id === currentDeviceId}
						<div class="bg-surface-raised border-border flex items-center justify-between rounded-lg border px-4 py-3">
							<div>
								<p class="text-text-primary text-sm font-medium">
									{device.device_name || 'Unknown Device'}
									{#if isCurrent}
										<span class="bg-accent/20 text-accent ml-2 rounded px-2 py-0.5 text-xs">Current</span>
									{/if}
								</p>
								<p class="text-text-muted text-xs">
									Last seen {new Date(device.last_seen_at).toLocaleDateString()}
								</p>
							</div>
							{#if !isCurrent}
								<div class="flex gap-2">
									<button
										class="border-border text-text-secondary hover:text-text-primary rounded-lg border px-3 py-1.5 text-xs"
										onclick={() => (confirmDevice = { id: device.id, action: 'logout' })}
									>
										Force Logout
									</button>
									<button
										class="border-error text-error rounded-lg border px-3 py-1.5 text-xs"
										onclick={() => (confirmDevice = { id: device.id, action: 'ban' })}
									>
										Ban
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if banned.length > 0}
				<div>
					<h3 class="text-text-muted mb-2 text-sm font-medium">Banned Devices</h3>
					<div class="space-y-3">
						{#each banned as device (device.id)}
							<div class="bg-surface-raised border-border flex items-center justify-between rounded-lg border px-4 py-3 opacity-50">
								<div>
									<p class="text-text-primary text-sm font-medium">
										{device.device_name || 'Unknown Device'}
										<span class="text-error ml-2 text-xs">Banned</span>
									</p>
									<p class="text-text-muted text-xs">
										Banned {device.banned_at ? new Date(device.banned_at).toLocaleDateString() : ''}
									</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</section>
</main>

<!-- Device action confirmation popup -->
{#if confirmDevice}
	{@const action = confirmDevice.action}
	<ConfirmPopup
		title={action === 'ban' ? 'Ban Device' : 'Force Logout'}
		message={action === 'ban'
			? 'Banning this device will permanently prevent it from accessing your account. The device owner will need to contact an administrator to unban it.'
			: 'This will immediately log out the device. The user can log in again from that device.'}
		confirmLabel={action === 'ban' ? 'Ban Device' : 'Force Logout'}
		destructive={true}
		onConfirm={executeDeviceAction}
		onCancel={() => (confirmDevice = null)}
	/>
{/if}

<Toast message={toastMessage} visible={toastVisible} />

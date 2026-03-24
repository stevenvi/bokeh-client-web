<script lang="ts">
	import { appStore } from '$lib/stores/app';
	import { authStore, claimsFromToken } from '$lib/stores/auth';
	import { login } from '$lib/api/auth';
	import { scheduleRefresh } from '$lib/refresh';
	import { getOrCreateDeviceUUID, deriveDeviceName } from '$lib/utils/deviceName';

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleLogin() {
		error = '';
		if (!username.trim() || !password) {
			error = 'Please enter your username and password.';
			return;
		}
		loading = true;
		try {
			const deviceUUID = getOrCreateDeviceUUID();
			const deviceName = deriveDeviceName();
			const res = await login({ username: username.trim(), password }, deviceUUID, deviceName);
			// Decode claims from the access token in the response body
			const claims = claimsFromToken(res.access_token, res.access_token_expires_in);
			if (!claims) throw new Error('Invalid token received from server.');
			authStore.setClaims(claims);
			appStore.setAuthenticated();
			scheduleRefresh(res.access_token_expires_in);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Login failed. Check your credentials.';
		} finally {
			loading = false;
		}
	}

	function handleDisconnect() {
		appStore.disconnect();
	}
</script>

<div class="flex min-h-dvh items-center justify-center bg-bg px-4">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<h1 class="text-text-primary text-3xl font-bold">Bokeh</h1>
			{#if $appStore.serverUrl}
				<div class="mt-2 flex items-center justify-center gap-2">
					<p class="text-text-muted truncate text-sm">{$appStore.serverUrl}</p>
					<button class="text-accent text-xs hover:underline" onclick={handleDisconnect}>
						Change
					</button>
				</div>
			{/if}
		</div>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleLogin();
			}}
			class="bg-surface rounded-xl p-6"
		>
			<div class="mb-4">
				<label class="text-text-secondary mb-1 block text-sm" for="username">Username</label>
				<input
					id="username"
					type="text"
					bind:value={username}
					class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 focus:border-accent focus:outline-none"
					autocomplete="username"
					autocapitalize="off"
				/>
			</div>

			<div class="mb-4">
				<label class="text-text-secondary mb-1 block text-sm" for="password">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 focus:border-accent focus:outline-none"
					autocomplete="current-password"
				/>
			</div>

			{#if error}
				<p class="text-error mb-3 text-sm">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="bg-accent hover:bg-accent-hover w-full rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
			>
				{loading ? 'Signing in…' : 'Sign In'}
			</button>
		</form>
	</div>
</div>

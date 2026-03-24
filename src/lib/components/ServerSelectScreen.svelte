<script lang="ts">
	import { appStore } from '$lib/stores/app';
	import { checkVersionCompatibility } from '$lib/utils/version';

	let serverUrl = $state($appStore.serverUrl ?? '');
	let error = $state('');
	let warning = $state('');
	let loading = $state(false);

	async function handleConnect() {
		error = '';
		warning = '';
		if (!serverUrl.trim()) {
			error = 'Please enter a server address.';
			return;
		}
		const url = serverUrl.trim().replace(/\/$/, '');
		loading = true;
		try {
			// Health check
			const healthRes = await fetch(`${url}/api/v1/system/health`);
			if (!healthRes.ok) {
				error = `Server returned ${healthRes.status}. Check the address and try again.`;
				return;
			}

			// Version check
			try {
				const versionRes = await fetch(`${url}/api/v1/system/version`);
				if (versionRes.ok) {
					const data = await versionRes.json();
					const compat = checkVersionCompatibility(data.version ?? '0.0.0');
					if (compat) warning = compat;
				}
			} catch {
				// version check failure is non-fatal
			}

			appStore.setServerUrl(url);
		} catch {
			error = 'Could not reach server. Check the address and your network connection.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-dvh items-center justify-center bg-bg px-4">
	<div class="w-full max-w-sm">
		<div class="mb-8 text-center">
			<h1 class="text-text-primary text-3xl font-bold">Bokeh</h1>
			<p class="text-text-muted mt-1 text-sm">Enter your server address to continue</p>
		</div>

		<form
			onsubmit={(e) => { e.preventDefault(); handleConnect(); }}
			class="bg-surface rounded-xl p-6"
		>
			<div class="mb-4">
				<label class="text-text-secondary mb-1 block text-sm" for="server-url">
					Server Address
				</label>
				<input
					id="server-url"
					type="url"
					bind:value={serverUrl}
					placeholder="http://192.168.1.1:3000"
					class="bg-surface-raised border-border text-text-primary w-full rounded-lg border px-3 py-2 focus:border-accent focus:outline-none"
					autocomplete="url"
				/>
			</div>

			{#if warning}
				<p class="text-warning mb-3 text-sm">{warning}</p>
			{/if}
			{#if error}
				<p class="text-error mb-3 text-sm">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="bg-accent hover:bg-accent-hover w-full rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
			>
				{loading ? 'Connecting…' : 'Connect'}
			</button>
		</form>
	</div>
</div>

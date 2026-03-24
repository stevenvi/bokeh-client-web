<script lang="ts">
	import { appStore } from '$lib/stores/app';
	import { logout } from '$lib/api/auth';

	let retryInterval: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		if (!$appStore.isConnected) {
			startRetry();
		} else {
			stopRetry();
		}
		return () => stopRetry();
	});

	function startRetry() {
		if (retryInterval) return;
		retryInterval = setInterval(async () => {
			try {
				const serverUrl = $appStore.serverUrl ?? '';
				const res = await fetch(`${serverUrl}/api/v1/system/health`);
				if (res.ok) {
					appStore.setConnected(true);
				}
			} catch {
				// still down
			}
		}, 5000);
	}

	function stopRetry() {
		if (retryInterval) {
			clearInterval(retryInterval);
			retryInterval = null;
		}
	}

	async function handleDisconnect() {
		try {
			await logout();
		} catch {
			// ignore
		}
		appStore.disconnect();
	}
</script>

{#if !$appStore.isConnected}
	<!-- Full-screen semi-transparent overlay -->
	<div class="fixed inset-0 z-40 bg-black/40"></div>

	<!-- Banner at top -->
	<div class="bg-error/90 fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 py-3">
		<div class="flex items-center gap-3">
			<div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
			<span class="text-sm font-medium text-white">Reconnecting to server…</span>
		</div>
		<button
			class="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/30"
			onclick={handleDisconnect}
		>
			Disconnect
		</button>
	</div>
{/if}

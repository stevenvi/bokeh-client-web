<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { appStore } from '$lib/stores/app';
	import { authStore } from '$lib/stores/auth';
	import { scheduleRefresh } from '$lib/refresh';
	import { getMe, refresh } from '$lib/api/auth';
	import { getOrCreateDeviceUUID } from '$lib/utils/deviceName';
	import NetworkErrorBanner from '$lib/components/NetworkErrorBanner.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { toastStore } from '$lib/stores/toast';
	import ServerSelectScreen from '$lib/components/ServerSelectScreen.svelte';
	import LoginScreen from '$lib/components/LoginScreen.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import MediaPlayer from '$lib/components/MediaPlayer.svelte';

	let { children } = $props();

	// Key for page fade transitions — changes on route navigation.
	const routeKey = $derived(page.url.pathname);

	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: 1,
				staleTime: 30_000
			}
		}
	});

	onMount(() => {
		function handleKeyDown(e: KeyboardEvent) {
			const isReload = e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r');
			if (!isReload) return;
			e.preventDefault();
			queryClient.invalidateQueries();
		}
		document.addEventListener('keydown', handleKeyDown);

		// If we have a saved server URL, attempt to restore the session.
		// First try /auth/me (access cookie may still be valid), then fall back
		// to /auth/refresh (refresh cookie lasts 90 days).
		if ($appStore.state === 'logging-in') {
			(async () => {
				try {
					let me: Awaited<ReturnType<typeof getMe>>;
					try {
						me = await getMe();
					} catch {
						// Access token expired — try refreshing with the 90-day refresh cookie.
						const deviceUUID = getOrCreateDeviceUUID();
						await refresh(deviceUUID);
						// Refresh succeeded — now getMe will work with the new access cookie.
						me = await getMe();
					}
					authStore.setClaims({
						userId: me.id,
						deviceId: me.device_id,
						isAdmin: me.is_admin,
						expiresAt: 0
					});
					appStore.setAuthenticated();
					scheduleRefresh(null);
				} catch {
					// Both access and refresh tokens are invalid — show login screen.
				}
			})();
		}

		return () => document.removeEventListener('keydown', handleKeyDown);
	});
</script>

<QueryClientProvider client={queryClient}>
	{#if $appStore.state === 'selecting-server'}
		<ServerSelectScreen />
	{:else if $appStore.state === 'logging-in'}
		<LoginScreen />
	{:else}
		<!-- Authenticated app shell -->
		<HamburgerMenu />
		{#key routeKey}
			<div class="page-transition">
				{@render children()}
			</div>
		{/key}
	{/if}

	<!-- Media player persists across all routes (audio + video) -->
	<MediaPlayer />

	<!-- Network error banner is always rendered so it can intercept failures at any time -->
	<NetworkErrorBanner />

	<!-- Global toast for admin actions -->
	<Toast message={$toastStore.message} visible={$toastStore.visible} />
</QueryClientProvider>

<style>
	@keyframes pageFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	.page-transition {
		animation: pageFadeIn 200ms ease-out;
	}
</style>

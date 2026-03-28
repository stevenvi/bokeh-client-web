<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { appStore } from '$lib/stores/app';
	import { authStore } from '$lib/stores/auth';
	import { navigationStore } from '$lib/stores/navigation';
	import { toolbarStore } from '$lib/stores/toolbar';
	import { logout } from '$lib/api/auth';

	let open = $state(false);
	const isHome = $derived(page.url.pathname === '/');
	const isAdmin = $derived(page.url.pathname === '/admin');

	function close() { open = false; }

	function navigate(path: string) {
		close();
		if (path === '/') navigationStore.reset();
		goto(path);
	}

	function goHome() {
		navigationStore.reset();
		goto('/');
	}

	function goTo(path: string) {
		navigationStore.popTo(path);
		goto(path);
	}

	function goBack() {
		const crumbs = currentCrumbs;
		if (crumbs.length >= 2) {
			goTo(crumbs[crumbs.length - 2].path);
		} else {
			goHome();
		}
	}

	// Subscribe to get current value synchronously in derived
	let currentCrumbs: { id: number; name: string; path: string }[] = $state([]);
	navigationStore.subscribe((v) => { currentCrumbs = v; });

	// Breadcrumb display: Home + entries, with middle collapse
	// Always show Home, always show leaf (last entry) with full name.
	// If >2 middle entries, collapse them to "..."
	const breadcrumbSegments = $derived(() => {
		const crumbs = currentCrumbs;
		if (crumbs.length === 0) return [];
		if (crumbs.length <= 3) {
			// Show all: each entry gets its own segment
			return crumbs.map((c, i) => ({
				type: 'entry' as const,
				path: c.path,
				name: c.name,
				isLeaf: i === crumbs.length - 1
			}));
		}
		// Collapse middle: Home > first > ... > leaf
		const first = crumbs[0];
		const leaf = crumbs[crumbs.length - 1];
		return [
			{ type: 'entry' as const, path: first.path, name: first.name, isLeaf: false },
			{ type: 'ellipsis' as const, path: '', name: '...', isLeaf: false },
			{ type: 'entry' as const, path: leaf.path, name: leaf.name, isLeaf: true }
		];
	});

	const leafName = $derived(
		currentCrumbs.length > 0
			? currentCrumbs[currentCrumbs.length - 1].name
			: ''
	);

	async function handleSignOut() {
		close();
		try { await logout(); } catch { /* ignore */ }
		authStore.clearClaims();
		appStore.signOut();
	}

	async function handleDisconnect() {
		close();
		try { await logout(); } catch { /* ignore */ }
		authStore.clearClaims();
		appStore.disconnect();
	}
</script>

<!-- Top bar -->
<nav class="bg-bg/90 sticky top-0 z-20 flex items-center gap-2 px-3 py-2 backdrop-blur-sm" aria-label="Top bar">
	{#if isAdmin}
		<!-- Admin page: back button + "Admin Dashboard" heading -->
		<button
			class="text-text-muted hover:text-text-primary md:hidden"
			onclick={() => history.back()}
			aria-label="Go back"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
			</svg>
		</button>
		<span class="text-text-primary min-w-0 flex-1 truncate text-sm font-semibold">
			Admin Dashboard
		</span>
	{:else}
		<!-- Mobile: back button + leaf name -->
		{#if !isHome}
			<button
				class="text-text-muted hover:text-text-primary md:hidden"
				onclick={goBack}
				aria-label="Go back"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
				</svg>
			</button>
			<span class="text-text-primary min-w-0 flex-1 truncate text-sm font-medium md:hidden">
				{leafName}
			</span>
		{:else}
			<span class="text-text-primary min-w-0 flex-1 truncate text-sm font-medium md:hidden">
				Your Library
			</span>
		{/if}

		<!-- Desktop: breadcrumb -->
		<div class="hidden min-w-0 flex-1 items-center gap-1 md:flex" aria-label="Breadcrumb">
			<button
				class="text-text-muted hover:text-text-primary flex flex-shrink-0 items-center gap-1 text-sm transition-colors"
				onclick={goHome}
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
				</svg>
				Home
			</button>

			{#each breadcrumbSegments() as seg (seg.type === 'ellipsis' ? 'ellipsis' : seg.path)}
				<svg class="text-text-muted h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
				</svg>
				{#if seg.type === 'ellipsis'}
					<span class="text-text-muted text-sm">...</span>
				{:else if seg.isLeaf}
					<span class="text-text-primary min-w-0 truncate text-sm font-medium">
						{seg.name}
					</span>
				{:else}
					<button
						class="text-text-secondary hover:text-text-primary max-w-[24rem] flex-shrink-0 truncate text-sm transition-colors"
						onclick={() => goTo(seg.path)}
					>
						{seg.name}
					</button>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Content-specific toolbar (e.g. album/waterfall/slideshow) -->
	{#if $toolbarStore}
		<div class="flex flex-shrink-0 items-center gap-0.5">
			<button
				class="rounded-md p-1.5 transition-colors {$toolbarStore.mode === 'album' ? 'bg-surface-raised text-text-primary' : 'text-text-muted hover:text-text-primary'}"
				onclick={() => $toolbarStore?.onModeChange('album')}
				title="Album view"
				aria-label="Album view"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
				</svg>
			</button>

			<button
				class="rounded-md p-1.5 transition-colors {$toolbarStore.mode === 'waterfall' ? 'bg-surface-raised text-text-primary' : 'text-text-muted hover:text-text-primary'}"
				onclick={() => $toolbarStore?.onModeChange('waterfall')}
				title="Timeline view"
				aria-label="Timeline view"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
				</svg>
			</button>

			<button
				class="rounded-md p-1.5 text-text-muted transition-colors hover:text-text-primary"
				onclick={() => $toolbarStore?.onSlideshow()}
				title="Slideshow"
				aria-label="Start slideshow"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h12A2.25 2.25 0 0020.25 14.25V3m-16.5 0h16.5m-16.5 0H1.5m18.75 0H22.5M9 8.25l2.25 2.25L15 6.75" />
				</svg>
			</button>
		</div>
	{/if}

	<!-- Hamburger button -->
	<button
		class="text-text-muted hover:text-text-primary flex-shrink-0 rounded-md p-1.5 transition-colors"
		onclick={() => (open = !open)}
		aria-label="Menu"
	>
		<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
		</svg>
	</button>
</nav>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-30 bg-black/40"
		role="presentation"
		onclick={close}
	></div>

	<!-- Drawer -->
	<div class="bg-surface border-border fixed right-0 top-0 z-40 flex h-full w-64 flex-col border-l shadow-xl">
		<div class="flex items-center justify-between p-4">
			<span class="text-text-primary font-semibold">Menu</span>
			<button onclick={close} aria-label="Close menu" class="text-text-muted hover:text-text-primary">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<nav class="flex flex-1 flex-col gap-1 px-2">
			{#if !isHome}
				<button
					class="text-text-primary hover:bg-surface-raised flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
					onclick={() => navigate('/')}
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
					</svg>
					Return Home
				</button>
			{/if}

			{#if $authStore?.isAdmin}
				<button
					class="text-text-primary hover:bg-surface-raised flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
					onclick={() => navigate('/admin')}
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					Admin Dashboard
				</button>
			{/if}

			<button
				class="text-text-primary hover:bg-surface-raised flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
				onclick={() => navigate('/profile')}
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
				</svg>
				Profile
			</button>
		</nav>

		<div class="border-border flex flex-col gap-1 border-t px-2 py-2">
			<button
				class="text-text-secondary hover:bg-surface-raised flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
				onclick={handleSignOut}
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
				</svg>
				Sign Out
			</button>
			<button
				class="text-text-muted hover:bg-surface-raised flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
				onclick={handleDisconnect}
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
				</svg>
				Disconnect from Server
			</button>
		</div>
	</div>
{/if}

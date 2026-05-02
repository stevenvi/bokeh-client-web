<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { appStore } from '$lib/stores/app';
	import { authStore } from '$lib/stores/auth';
	import { navigationStore, type BreadcrumbEntry } from '$lib/stores/navigation';
	import { toolbarStore } from '$lib/stores/toolbar';
	import { goBack } from '$lib/utils/breadcrumb.svelte';
	import { logout } from '$lib/api/auth';
	import { useQueryClient } from '@tanstack/svelte-query';
	import {
		IconChevronLeft,
		IconHome,
		IconGear,
		IconUser,
		IconSignOut,
		IconDisconnect,
		IconGridView,
		IconWaterfallView,
		IconMenu,
		IconClose,
		IconChevronRight
	} from './icons';

	const queryClient = useQueryClient();
	let open = $state(false);
	const isHome = $derived(page.url.pathname === '/');

	function close() { open = false; }

	function navigate(path: string) {
		close();
		if (path === '/') {
			navigationStore.snapshotForHistory();
			navigationStore.reset();
		}
		goto(path);
	}

	function goHome() {
		navigationStore.snapshotForHistory();
		navigationStore.reset();
		goto('/');
	}

	function goTo(path: string) {
		navigationStore.snapshotForHistory();
		navigationStore.popTo(path);
		goto(path);
	}

	// Subscribe to get current value synchronously in derived. Hidden entries
	// participate in pop semantics but are not displayed.
	let allCrumbs: BreadcrumbEntry[] = $state([]);
	navigationStore.subscribe((v) => { allCrumbs = v; });
	const currentCrumbs = $derived(allCrumbs.filter((c) => !c.hidden));

	// Breadcrumb display: Home + entries, with middle collapse
	// Always show Home, always show leaf (last entry) with full name.
	// If >2 middle entries, collapse them to "..."
	type Segment = { type: 'entry' | 'ellipsis'; path: string; name: string; isLeaf: boolean };
	const breadcrumbSegments = $derived.by((): Segment[] => {
		let crumbs: { path: string; name: string }[] = currentCrumbs;
		if (crumbs.length === 0) return [];

		if (crumbs.length > 5) {
			// Collapse middle: Home > first > second > ... > n-1 > leaf
			crumbs = [
				crumbs[0],
				crumbs[1],
				{ path: '', name: '...' },
				crumbs[crumbs.length - 2],
				crumbs[crumbs.length - 1]
			];
		}

		return crumbs.map((c, i) => ({
			type: c.name === '...' ? 'ellipsis' : 'entry',
			path: c.path,
			name: c.name,
			isLeaf: i === crumbs.length - 1
		}));
	});

	const leafName = $derived(
		currentCrumbs.length > 0 ? currentCrumbs[currentCrumbs.length - 1].name : ''
	);

	async function handleSignOut() {
		close();
		try { await logout(); } catch { /* ignore */ }
		queryClient.clear();
		authStore.clearClaims();
		appStore.signOut();
	}

	async function handleDisconnect() {
		close();
		try { await logout(); } catch { /* ignore */ }
		queryClient.clear();
		authStore.clearClaims();
		appStore.disconnect();
	}
</script>

<!-- Top bar -->
<nav class="bg-bg sticky top-0 z-20 flex items-center gap-2 px-3 py-2 backdrop-blur-sm" aria-label="Top bar">
	<!-- Mobile: back button + title -->
	{#if !isHome}
		<button
			class="text-text-secondary hover:text-text-primary md:hidden"
			onclick={goBack}
			aria-label="Go back"
		>
			<IconChevronLeft class="h-5 w-5" />
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
			class="text-text-secondary hover:text-text-primary flex flex-shrink-0 items-center gap-1 text-sm transition-colors"
			onclick={goHome}
		>
			<IconHome class="h-4 w-4" />
			Home
		</button>

		{#each breadcrumbSegments as seg (seg.type === 'ellipsis' ? 'ellipsis' : seg.path)}
			<IconChevronRight class="text-text-muted h-4 w-4 flex-shrink-0" />
			{#if seg.type === 'ellipsis'}
				<span class="text-text-secondary text-sm">...</span>
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

	<!-- Content-specific toolbar (e.g. album/waterfall) -->
	{#if $toolbarStore}
		<div class="flex flex-shrink-0 items-center gap-0.5">
			<button
				class="rounded-md p-1.5 transition-colors {$toolbarStore.mode === 'album' ? 'bg-surface-raised text-text-primary' : 'text-text-secondary hover:text-text-primary'}"
				onclick={() => $toolbarStore?.onModeChange('album')}
				title="Album view"
				aria-label="Album view"
			>
				<IconGridView class="h-5 w-5" />
			</button>

			<button
				class="rounded-md p-1.5 transition-colors {$toolbarStore.mode === 'waterfall' ? 'bg-surface-raised text-text-primary' : 'text-text-secondary hover:text-text-primary'}"
				onclick={() => $toolbarStore?.onModeChange('waterfall')}
				title="Timeline view"
				aria-label="Timeline view"
			>
				<IconWaterfallView class="h-5 w-5" />
			</button>
		</div>
	{/if}

	<!-- Hamburger button -->
	<button
		class="text-text-secondary hover:text-text-primary flex-shrink-0 rounded-md p-1.5 transition-colors"
		onclick={() => (open = !open)}
		aria-label="Menu"
	>
		<IconMenu class="h-5 w-5" />
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
			<button onclick={close} aria-label="Close menu" class="text-text-secondary hover:text-text-primary">
				<IconClose class="h-5 w-5" />
			</button>
		</div>

		<nav class="flex flex-1 flex-col gap-1 px-2">
			{#if !isHome}
				<button
					class="text-text-primary hover:bg-surface-raised flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm md:hidden"
					onclick={() => navigate('/')}
				>
					<IconHome class="h-5 w-5" />
					Return Home
				</button>
			{/if}

			{#if $authStore?.isAdmin}
				<button
					class="text-text-primary hover:bg-surface-raised flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
					onclick={() => navigate('/admin')}
				>
					<IconGear class="h-5 w-5" />
					Admin Dashboard
				</button>
			{/if}

			<button
				class="text-text-primary hover:bg-surface-raised flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
				onclick={() => navigate('/profile')}
			>
				<IconUser class="h-5 w-5" />
				Profile
			</button>
		</nav>

		<div class="border-border flex flex-col gap-1 border-t px-2 py-2">
			<button
				class="text-text-secondary hover:bg-surface-raised flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
				onclick={handleSignOut}
			>
				<IconSignOut class="h-5 w-5" />
				Sign Out
			</button>
			<button
				class="text-text-secondary hover:bg-surface-raised flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
				onclick={handleDisconnect}
			>
				<IconDisconnect class="h-5 w-5" />
				Disconnect from Server
			</button>
		</div>
	</div>
{/if}

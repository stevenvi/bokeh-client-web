<script lang="ts">
	import { onMount } from 'svelte';
	import { adminListDirectories, type DirectoryEntry } from '$lib/api/admin';
	import PathBrowserNode from './PathBrowserNode.svelte';

	let {
		selectedPath = $bindable(''),
		selectedType = $bindable('')
	}: { selectedPath?: string; selectedType?: string } = $props();

	type NodeState = {
		children: DirectoryEntry[] | 'error' | null; // null = loading
		expanded: boolean;
	};

	let nodes = $state<Record<string, NodeState>>({});

	let rootNode = $derived(nodes['']);
	let rootLoading = $derived(!rootNode || rootNode.children === null);
	let rootError = $derived(rootNode?.children === 'error');
	let rootChildren = $derived(
		Array.isArray(rootNode?.children) ? (rootNode.children as DirectoryEntry[]) : []
	);

	async function fetchDir(path: string) {
		if (path in nodes) return;
		nodes[path] = { children: null, expanded: false };
		try {
			const entries = await adminListDirectories(path);
			nodes[path] = { children: entries, expanded: false };
		} catch {
			nodes[path] = { children: 'error', expanded: false };
		}
	}

	function toggleExpand(path: string) {
		const node = nodes[path];
		if (!node || !Array.isArray(node.children) || node.children.length === 0) return;
		nodes[path] = { ...node, expanded: !node.expanded };
	}

	onMount(() => fetchDir(''));
</script>

<div class="bg-surface-raised border-border h-56 overflow-y-auto rounded-lg border py-1">
	{#if rootLoading}
		<p class="text-text-muted px-3 py-2 text-xs">Loading…</p>
	{:else if rootError}
		<p class="text-error px-3 py-2 text-xs">Failed to load media root.</p>
	{:else if rootChildren.length === 0}
		<p class="text-text-muted px-3 py-2 text-xs">No directories found in media root.</p>
	{:else}
		{#each rootChildren as entry (entry.name)}
			<PathBrowserNode
				path={entry.name}
				name={entry.name}
				entryType={entry.type}
				depth={0}
				{nodes}
				{selectedPath}
				{fetchDir}
				{toggleExpand}
				onSelect={(p, t) => { selectedPath = p; selectedType = t; }}
			/>
		{/each}
	{/if}
</div>

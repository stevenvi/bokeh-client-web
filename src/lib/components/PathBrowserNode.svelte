<script lang="ts">
	import { onMount } from 'svelte';

	type NodeState = {
		children: string[] | 'error' | null; // null = loading
		expanded: boolean;
	};

	let {
		path,
		name,
		depth,
		nodes,
		selectedPath,
		fetchDir,
		toggleExpand,
		onSelect
	}: {
		path: string;
		name: string;
		depth: number;
		nodes: Record<string, NodeState>;
		selectedPath: string;
		fetchDir: (path: string) => void;
		toggleExpand: (path: string) => void;
		onSelect: (path: string) => void;
	} = $props();

	let node = $derived(nodes[path]);
	let hasChildren = $derived(
		node !== undefined && Array.isArray(node.children) && (node.children as string[]).length > 0
	);
	let isExpanded = $derived(node?.expanded ?? false);
	let isSelected = $derived(selectedPath === path);
	let isError = $derived(node?.children === 'error');

	// Rows inside a wrapper need 9px left padding regardless of depth; depth-0 rows use 4px.
	// This keeps toggle buttons at their expected absolute positions after the wrapper margins.
	let rowPadding = $derived(depth === 0 ? 4 : 9);

	// First-level children wrapper aligns its border with the center of the depth-0 toggle (11px).
	// Deeper wrappers are already shifted by parent wrappers, so 16px advances one indent step.
	let wrapperMargin = $derived(depth === 0 ? 11 : 16);

	onMount(() => fetchDir(path));
</script>

<div>
	<div
		role="button"
		tabindex="0"
		class="flex w-full cursor-pointer items-center gap-1.5 rounded-sm py-0.5 pr-2 hover:bg-white/5 {isSelected ? 'bg-accent/10' : ''}"
		style="padding-left: {rowPadding}px"
		onclick={() => onSelect(path)}
		onkeydown={(e) => e.key === 'Enter' && onSelect(path)}
	>
		{#if isError}
			<span
				class="text-warning flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center text-[11px]"
				title="Failed to read directory"
			>⚠</span>
		{:else if hasChildren}
			<button
				type="button"
				class="flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center rounded-sm border border-white/25 text-[10px] leading-none text-text-primary"
				onclick={(e) => { e.stopPropagation(); toggleExpand(path); }}
			>
				{isExpanded ? '−' : '+'}
			</button>
		{:else}
			<span class="h-[14px] w-[14px] flex-shrink-0"></span>
		{/if}

		<span
			class="truncate text-sm"
			class:text-accent={isSelected}
			class:text-text-primary={!isSelected}
		>
			{name}
		</span>
	</div>

	{#if isExpanded && Array.isArray(node?.children)}
		<div class="border-l border-white/10" style="margin-left: {wrapperMargin}px">
			{#each node.children as childName (childName)}
				<svelte:self
					path="{path}/{childName}"
					name={childName}
					depth={depth + 1}
					{nodes}
					{selectedPath}
					{fetchDir}
					{toggleExpand}
					{onSelect}
				/>
			{/each}
		</div>
	{/if}
</div>

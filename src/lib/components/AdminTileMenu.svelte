<script module lang="ts">
	let activeMenu = $state<symbol | null>(null);
</script>

<script lang="ts">
	import { toastStore } from '$lib/stores/toast';
	import { IconSpinner, IconThreeDots } from './icons';

	export interface AdminMenuItem {
		emoji: string;
		label: string;
		action?: () => Promise<void> | void;
		fileAccept?: string;
		onFile?: (file: File) => Promise<void>;
	}

	interface Props {
		items: AdminMenuItem[];
	}

	let { items }: Props = $props();
	const menuId = Symbol();
	const open = $derived(activeMenu === menuId);
	let loading = $state(false);

	async function run(fn: () => Promise<void> | void) {
		activeMenu = null;
		loading = true;
		try {
			await fn();
		} catch (e: unknown) {
			toastStore.show(e instanceof Error ? e.message : 'Action failed.');
		} finally {
			loading = false;
		}
	}

	function onFileChange(item: AdminMenuItem, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !item.onFile) return;
		run(() => item.onFile!(file));
	}
</script>

<div class="relative">
	<button
		class="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80 disabled:opacity-40"
		onclick={(e) => { e.stopPropagation(); if (!loading) activeMenu = open ? null : menuId; }}
		aria-label="More options"
	>
		{#if loading}
			<IconSpinner class="h-3 w-3 animate-spin" />
		{:else}
			<IconThreeDots class="h-3 w-3" />
		{/if}
	</button>

	{#if open}
		<div class="fixed inset-0 z-40" onclick={(e) => { e.stopPropagation(); activeMenu = null; }}></div>
		<div class="border-border bg-surface absolute right-0 top-full z-50 mt-1 min-w-44 overflow-hidden rounded-lg border shadow-xl">
			{#each items as item}
				{#if item.fileAccept && item.onFile}
					<label
						class="text-text-primary hover:bg-surface-raised flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm"
						onclick={(e) => e.stopPropagation()}
					>
						<span>{item.emoji}</span>
						<span>{item.label}</span>
						<input
							type="file"
							accept={item.fileAccept}
							class="hidden"
							onchange={(e) => { e.stopPropagation(); onFileChange(item, e); }}
						/>
					</label>
				{:else if item.action}
					<button
						class="text-text-primary hover:bg-surface-raised flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
						onclick={(e) => { e.stopPropagation(); run(item.action!); }}
					>
						<span>{item.emoji}</span>
						<span>{item.label}</span>
					</button>
				{/if}
			{/each}
		</div>
	{/if}
</div>

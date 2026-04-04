<script lang="ts">
	import { toastStore } from '$lib/stores/toast';

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
	let open = $state(false);
	let loading = $state(false);

	async function run(fn: () => Promise<void> | void) {
		open = false;
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
		onclick={(e) => { e.stopPropagation(); if (!loading) open = !open; }}
		aria-label="More options"
	>
		{#if loading}
			<svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
			</svg>
		{:else}
			<svg class="h-3 w-3" viewBox="0 0 16 4" fill="currentColor">
				<circle cx="2" cy="2" r="1.5"></circle>
				<circle cx="8" cy="2" r="1.5"></circle>
				<circle cx="14" cy="2" r="1.5"></circle>
			</svg>
		{/if}
	</button>

	{#if open}
		<div class="fixed inset-0 z-40" onclick={(e) => { e.stopPropagation(); open = false; }}></div>
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

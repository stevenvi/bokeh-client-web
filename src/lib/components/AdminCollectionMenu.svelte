<script lang="ts">
	import { useQueryClient } from '@tanstack/svelte-query';
	import AdminTileMenu from './AdminTileMenu.svelte';
	import ConfirmPopup from './ConfirmPopup.svelte';
	import {
		adminCreateJob,
		adminUploadCollectionCover,
		adminDeleteCollection,
		adminListCollectionUsers,
		adminSetCollectionUsers,
		adminListUsers
	} from '$lib/api/admin';
	import { bumpCoverBust } from '$lib/stores/coverBust';
	import { toastStore } from '$lib/stores/toast';
	import type { AdminUser } from '$lib/types';

	interface Props {
		collection: { id: number; name: string };
	}

	let { collection }: Props = $props();

	const queryClient = useQueryClient();

	// ── Grant Access ──────────────────────────────────────────────────────────
	let showGrantAccess = $state(false);
	let grantAccessUsers = $state<AdminUser[]>([]);
	let grantAccessSelected = $state<Set<number>>(new Set());
	let grantAccessLoading = $state(false);

	async function openGrantAccess() {
		showGrantAccess = true;
		try {
			const [users, currentIds] = await Promise.all([
				adminListUsers(),
				adminListCollectionUsers(collection.id)
			]);
			grantAccessUsers = users;
			grantAccessSelected = new Set(currentIds);
		} catch {
			grantAccessSelected = new Set();
		}
	}

	function toggleUser(userId: number) {
		const next = new Set(grantAccessSelected);
		if (next.has(userId)) next.delete(userId);
		else next.add(userId);
		grantAccessSelected = next;
	}

	async function saveGrantAccess() {
		grantAccessLoading = true;
		try {
			await adminSetCollectionUsers(collection.id, [...grantAccessSelected]);
			toastStore.show('Access permissions saved.');
			showGrantAccess = false;
		} catch (e: unknown) {
			toastStore.show(e instanceof Error ? e.message : 'Failed to save permissions.');
		} finally {
			grantAccessLoading = false;
		}
	}

	// ── Delete ────────────────────────────────────────────────────────────────
	let confirmDelete = $state(false);

	async function handleDelete() {
		try {
			await adminDeleteCollection(collection.id);
			toastStore.show('Collection deleted.');
			queryClient.invalidateQueries({ queryKey: ['admin-collections'] });
			queryClient.invalidateQueries({ queryKey: ['collections'] });
		} catch (e: unknown) {
			toastStore.show(e instanceof Error ? e.message : 'Failed to delete collection.');
		} finally {
			confirmDelete = false;
		}
	}
</script>

<AdminTileMenu items={[
	{ emoji: '🔄', label: 'Rescan Library', action: async () => { const r = await adminCreateJob('collection_scan', collection.id, 'collection'); toastStore.show(`Scan job #${r.id} queued.`); } },
	{ emoji: '🖼', label: 'Rescan Thumbnails', action: async () => { const r = await adminCreateJob('thumbnail_scan', collection.id, 'collection'); toastStore.show(`Thumbnail scan job #${r.id} queued.`); } },
	{ emoji: '👥', label: 'Grant Access', action: () => openGrantAccess() },
	{ emoji: '🖼', label: 'Upload Cover Image', fileAccept: 'image/*', onFile: async (f) => { await adminUploadCollectionCover(collection.id, f); bumpCoverBust(collection.id); toastStore.show('Cover updated.'); } },
	{ emoji: '🗑', label: 'Delete Collection', action: () => { confirmDelete = true; } }
]} />

{#if showGrantAccess}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="bg-surface flex h-full max-h-[600px] w-full max-w-sm flex-col rounded-xl p-6">
			<h3 class="text-text-primary mb-4 text-lg font-semibold">
				Grant Access — {collection.name}
			</h3>
			<div class="flex-1 space-y-2 overflow-y-auto">
				{#each grantAccessUsers as user (user.id)}
					<label
						class="bg-surface-raised border-border flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3"
					>
						<input
							type="checkbox"
							checked={grantAccessSelected.has(user.id)}
							onchange={() => toggleUser(user.id)}
							class="accent-accent"
						/>
						<span class="text-text-primary text-sm">{user.name}</span>
					</label>
				{/each}
			</div>
			<div class="flex gap-3 pt-4">
				<button
					class="border-border text-text-secondary flex-1 rounded-lg border px-4 py-2 text-sm"
					onclick={() => (showGrantAccess = false)}
				>
					Cancel
				</button>
				<button
					class="bg-accent hover:bg-accent-hover flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					disabled={grantAccessLoading}
					onclick={saveGrantAccess}
				>
					{grantAccessLoading ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if confirmDelete}
	<ConfirmPopup
		title="Delete Collection"
		message="This will remove the collection from Bokeh. No files will be deleted from your media library. This action cannot be undone."
		confirmLabel="Delete"
		destructive={true}
		onConfirm={handleDelete}
		onCancel={() => (confirmDelete = false)}
	/>
{/if}

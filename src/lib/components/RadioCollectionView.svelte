<script lang="ts">
	import { createQuery } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { listShows } from '$lib/api/radio';
	import { navigationStore } from '$lib/stores/navigation';
	import ShowTile from './ShowTile.svelte';
	import AdminTileMenu from './AdminTileMenu.svelte';
	import { authStore } from '$lib/stores/auth';
	import { adminUploadArtistImage, adminDeleteArtistImage } from '$lib/api/admin';
	import { artistImageBust, bumpArtistImageBust } from '$lib/stores/coverBust';
	import { toastStore } from '$lib/stores/toast';

	interface Props {
		collectionId: number;
		collectionName: string;
		parentCollectionId: number | null;
	}

	let { collectionId, collectionName, parentCollectionId }: Props = $props();

	const showsQuery = $derived(
		createQuery({
			queryKey: ['radio', 'shows', collectionId],
			queryFn: () => listShows(collectionId)
		})
	);

	const allShows = $derived($showsQuery.data?.shows ?? []);

	function openShow(showId: number, showName: string) {
		navigationStore.push({ id: showId, name: showName, path: `/radio/show/${showId}?collection=${collectionId}` });
		goto(`/radio/show/${showId}?collection=${collectionId}`);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (parentCollectionId != null) {
				goto(`/collection/${parentCollectionId}`);
			} else {
				goto(navigationStore.previousPath());
			}
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="min-h-dvh">
	<div class="px-4 py-4">
		{#if $showsQuery.isPending}
			<div class="flex h-48 items-center justify-center">
				<div class="border-accent h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"></div>
			</div>
		{:else if $showsQuery.isError}
			<p class="text-error p-6">Failed to load shows.</p>
		{:else if allShows.length === 0}
			<p class="text-text-muted p-6 text-center">No shows found.</p>
		{:else}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{#each allShows as show (show.show_id)}
					<div class="relative">
						<ShowTile
							showId={show.show_id}
							name={show.name}
							bust={$artistImageBust[show.show_id]}
							onClickTitle={() => openShow(show.show_id, show.name)}
						/>
						{#if $authStore?.isAdmin}
							<div class="absolute top-1 right-1 z-10" onclick={(e) => e.stopPropagation()}>
								<AdminTileMenu items={[
									{ emoji: '🖼', label: 'Upload Image', fileAccept: 'image/*', onFile: async (f) => { await adminUploadArtistImage(show.show_id, f); bumpArtistImageBust(show.show_id); toastStore.show('Show image updated.'); } },
									{ emoji: '🗑', label: 'Remove Image', action: async () => { await adminDeleteArtistImage(show.show_id); bumpArtistImageBust(show.show_id); toastStore.show('Show image removed.'); } }
								]} />
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

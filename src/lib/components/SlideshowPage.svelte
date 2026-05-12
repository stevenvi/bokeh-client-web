<script lang="ts">
	import { parseCollectionIds, loadCollectionChain, applyBreadcrumbs } from '$lib/utils/collectionPath';
	import { navigationStore } from '$lib/stores/navigation';
	import SlideshowView from '$lib/components/SlideshowView.svelte';

	interface Props {
		path: string;
		startOrdinal: number;
		// URL prefix up to and including "slideshow/" — used for breadcrumbs and ordinal URL updates
		slideshowUrlPrefix: string;
		// Extra breadcrumb entries inserted between the collection crumbs and the hidden slideshow crumb
		extraBreadcrumbs?: { id: number; name: string; path: string }[];
		order: 'asc' | 'desc';
		recursive: boolean;
		onOrdinalChange: (ordinal: number) => void;
	}

	const {
		path,
		startOrdinal,
		slideshowUrlPrefix,
		extraBreadcrumbs = [],
		order,
		recursive,
		onOrdinalChange,
	}: Props = $props();

	let loadState = $state<'loading' | 'error' | 'loaded'>('loading');
	let collectionId = $state(0);
	let collectionName = $state('');

	$effect(() => {
		const ids = parseCollectionIds(path);
		if (!ids) {
			loadState = 'error';
			return;
		}

		loadState = 'loading';
		let cancelled = false;
		// Captured when we push the hidden breadcrumb so we can pop precisely
		// that entry on unmount, regardless of any ordinal-driven URL changes.
		let pushedSlideshowPath: string | null = null;

		loadCollectionChain(ids).then((collections) => {
			if (cancelled) return;
			if (!collections || !collections[collections.length - 1].type.startsWith('image:')) {
				loadState = 'error';
				return;
			}
			const leaf = collections[collections.length - 1];
			const slideshowPath = slideshowUrlPrefix + (startOrdinal + 1);
			applyBreadcrumbs([
				{ id: -1, name: 'Photos', path: '/photo' },
				...collections.map((col, i) => ({
					id: col.id,
					name: col.name,
					path: '/photo/' + ids.slice(0, i + 1).join('/')
				})),
				...extraBreadcrumbs,
				{ id: leaf.id, name: 'Slideshow', path: slideshowPath, hidden: true }
			]);
			pushedSlideshowPath = slideshowPath;
			collectionId = leaf.id;
			collectionName = leaf.name;
			loadState = 'loaded';
		});

		return () => {
			cancelled = true;
			// On unmount (or path change), remove the hidden Slideshow anchor we
			// pushed. Without this, the parent layout doesn't re-run its
			// breadcrumb effect (pathParam didn't change), so the stale hidden
			// entry would remain and break goBack() — it'd try to navigate to
			// the page the user is already on.
			if (pushedSlideshowPath) {
				navigationStore.popLeafIfHidden(pushedSlideshowPath);
			}
		};
	});
</script>

<svelte:head><title>Slideshow — Bokeh</title></svelte:head>

{#if loadState === 'error'}
	<p class="text-error p-6">Collection not found.</p>
{:else if loadState === 'loaded'}
	<SlideshowView
		{collectionId}
		{collectionName}
		autoplay={false}
		{order}
		{recursive}
		{startOrdinal}
		{onOrdinalChange}
	/>
{/if}

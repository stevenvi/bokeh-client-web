<script lang="ts">
	import { navigationStore } from '$lib/stores/navigation';

	interface Props {
		/** Breadcrumb entry path the scroll offset is keyed to. */
		path: string;
	}

	let { path }: Props = $props();

	$effect(() => {
		const currentPath = path;
		const container = document.getElementById('app-scroll');
		if (!container) return;

		const saved = navigationStore.getScrollForPath(currentPath);

		let cancelled = false;
		// While restoration is in progress we must not write the (still-zero)
		// scrollTop back to the store and clobber the saved value. Cleared once
		// the polling loop either succeeds or gives up.
		let restoreComplete = saved <= 0;

		if (saved > 0) {
			let attempts = 0;
			const tick = () => {
				if (cancelled || restoreComplete) return;
				const max = container.scrollHeight - container.clientHeight;
				if (max >= saved) {
					container.scrollTo(0, saved);
					restoreComplete = true;
					return;
				}
				if (attempts++ > 240) {
					// Give up after ~4s. Don't scrollTo — that would clamp to a
					// smaller value and trigger a save loop that overwrites the
					// real saved offset with the partial one.
					restoreComplete = true;
					return;
				}
				requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		}

		// Continuously record the scroll offset while the page is mounted.
		// Doing this on every scroll (rather than only at unmount) sidesteps
		// the {#key routeKey} teardown race where scrollTop is already 0 by
		// the time the cleanup runs.
		let pendingFrame: number | null = null;
		const onScroll = () => {
			if (!restoreComplete) return;
			if (pendingFrame != null) return;
			pendingFrame = requestAnimationFrame(() => {
				pendingFrame = null;
				const y = container.scrollTop;
				navigationStore.saveScrollForPath(currentPath, y);
			});
		};
		container.addEventListener('scroll', onScroll, { passive: true });

		return () => {
			cancelled = true;
			container.removeEventListener('scroll', onScroll);
			if (pendingFrame != null) cancelAnimationFrame(pendingFrame);
		};
	});
</script>

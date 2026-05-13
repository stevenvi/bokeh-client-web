<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		label?: string;
		// Wait this many animation frames before becoming visible. Useful when the
		// indicator may unmount almost immediately (e.g. the resource was already
		// cached) — the user never sees a flicker.
		delayFrames?: number;
	}

	let { label = '', delayFrames = 0 }: Props = $props();

	let visible = $state(delayFrames === 0);
	let cancelled = false;

	onMount(() => {
		if (delayFrames <= 0) return;
		let remaining = delayFrames;
		const step = () => {
			if (cancelled) return;
			remaining -= 1;
			if (remaining <= 0) {
				visible = true;
			} else {
				requestAnimationFrame(step);
			}
		};
		requestAnimationFrame(step);
	});

	onDestroy(() => {
		cancelled = true;
	});
</script>

{#if visible}
	<div class="loading-indicator">
		<div class="spinner" aria-hidden="true"></div>
		{#if label}<span class="label">{label}</span>{/if}
	</div>
{/if}

<style>
	.loading-indicator {
		position: absolute;
		top: 3rem;
		right: 1rem;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		pointer-events: none;
		color: rgba(255, 255, 255, 0.95);
		font-size: 0.75rem;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
	}

	.spinner {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.25);
		border-top-color: rgba(255, 255, 255, 0.85);
		animation: spin 0.75s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

<script lang="ts">
	let {
		playing,
		feedbackKey,
		class: klass = 'absolute inset-0 z-20'
	}: { playing: boolean; feedbackKey: number; class?: string } = $props();
</script>

{#key feedbackKey}
	{#if feedbackKey > 0}
		<div class="play-feedback pointer-events-none flex items-center justify-center {klass}">
			<div class="play-feedback-icon rounded-full bg-black/50 p-6">
				{#if playing}
					<svg class="h-16 w-16 text-white" fill="currentColor" viewBox="0 0 24 24">
						<path d="M8 5v14l11-7z" />
					</svg>
				{:else}
					<svg class="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
					</svg>
				{/if}
			</div>
		</div>
	{/if}
{/key}

<style>
	.play-feedback {
		animation: play-feedback-fade 700ms ease-out forwards;
	}

	.play-feedback-icon {
		animation: play-feedback-scale 700ms ease-out forwards;
	}

	@keyframes play-feedback-fade {
		0% {
			opacity: 0;
		}
		15% {
			opacity: 1;
		}
		65% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	@keyframes play-feedback-scale {
		0% {
			transform: scale(0.7);
		}
		15% {
			transform: scale(1);
		}
		100% {
			transform: scale(1.15);
		}
	}
</style>

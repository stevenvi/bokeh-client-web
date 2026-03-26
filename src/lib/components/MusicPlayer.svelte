<script lang="ts">
	import { musicPlayerStore } from '$lib/stores/musicPlayer';
	import { albumCoverUrl } from '$lib/api/music';

	const playerState = $derived($musicPlayerStore);
	const currentTrack = $derived(playerState.queue[playerState.currentIndex]);
	const visible = $derived(playerState.visible && currentTrack != null);

	function formatTime(seconds: number): string {
		if (!isFinite(seconds) || seconds < 0) return '0:00';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function handleSeek(e: MouseEvent) {
		const bar = e.currentTarget as HTMLElement;
		const rect = bar.getBoundingClientRect();
		const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		if (playerState.duration > 0) {
			musicPlayerStore.seekTo(ratio * playerState.duration);
		}
	}

	function handleSeekTouch(e: TouchEvent) {
		const bar = e.currentTarget as HTMLElement;
		const rect = bar.getBoundingClientRect();
		const touch = e.touches[0];
		const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
		if (playerState.duration > 0) {
			musicPlayerStore.seekTo(ratio * playerState.duration);
		}
	}

	const progress = $derived(playerState.duration > 0 ? (playerState.currentTime / playerState.duration) * 100 : 0);

	let coverLoaded = $state(false);
	let coverError = $state(false);

	// Reset cover state when track changes
	$effect(() => {
		if (currentTrack) {
			coverLoaded = false;
			coverError = false;
		}
	});
</script>

{#if visible}
	<div class="fixed inset-x-0 bottom-0 z-50 bg-surface-raised border-t border-border shadow-lg pb-safe">
		<!-- Progress bar (thin line above the controls) -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="h-1 w-full cursor-pointer bg-border"
			onclick={handleSeek}
			ontouchmove={handleSeekTouch}
		>
			<div
				class="bg-accent h-full transition-[width] duration-100"
				style="width: {progress}%"
			></div>
		</div>

		<div class="flex items-center gap-3 px-3 py-2">
			<!-- Album art thumbnail -->
			<div class="bg-surface relative h-10 w-10 flex-shrink-0 overflow-hidden rounded">
				{#if currentTrack && !coverError}
					<img
						src={albumCoverUrl(currentTrack.albumId)}
						alt=""
						class="h-full w-full object-cover"
						class:opacity-0={!coverLoaded}
						onload={() => (coverLoaded = true)}
						onerror={() => (coverError = true)}
					/>
				{/if}
				{#if !coverLoaded || coverError}
					<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-raised to-border">
						<svg class="text-text-muted h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
						</svg>
					</div>
				{/if}
			</div>

			<!-- Track info -->
			<div class="min-w-0 flex-1">
				<p class="text-text-primary truncate text-sm font-medium">
					{currentTrack?.title ?? ''}
				</p>
				<p class="text-text-muted truncate text-xs">
					{currentTrack?.artistName ?? currentTrack?.albumName ?? ''}
				</p>
			</div>

			<!-- Time display (hidden on very small screens) -->
			<span class="text-text-muted hidden text-xs tabular-nums sm:block">
				{formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
			</span>

			<!-- Controls -->
			<div class="flex items-center gap-1">
				<!-- Previous -->
				<button
					class="text-text-secondary hover:text-text-primary p-1.5 transition-colors"
					onclick={() => musicPlayerStore.previous()}
					aria-label="Previous track"
				>
					<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
						<path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
					</svg>
				</button>

				<!-- Play/Pause -->
				<button
					class="text-text-primary hover:text-accent p-1.5 transition-colors"
					onclick={() => (playerState.isPlaying ? musicPlayerStore.pause() : musicPlayerStore.play())}
					aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
				>
					{#if playerState.isPlaying}
						<svg class="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
							<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
						</svg>
					{:else}
						<svg class="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
							<path d="M8 5v14l11-7z" />
						</svg>
					{/if}
				</button>

				<!-- Next -->
				<button
					class="text-text-secondary hover:text-text-primary p-1.5 transition-colors"
					onclick={() => musicPlayerStore.next()}
					aria-label="Next track"
				>
					<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
						<path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
					</svg>
				</button>

				<!-- Shuffle (hidden on small screens) -->
				<button
					class="hidden p-1.5 transition-colors sm:block"
					class:text-accent={playerState.shuffle}
					class:text-text-muted={!playerState.shuffle}
					onclick={() => musicPlayerStore.toggleShuffle()}
					aria-label="Toggle shuffle"
				>
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
					</svg>
				</button>

				<!-- Repeat (hidden on small screens) -->
				<button
					class="hidden p-1.5 transition-colors sm:block"
					class:text-accent={playerState.repeat !== 'none'}
					class:text-text-muted={playerState.repeat === 'none'}
					onclick={() => musicPlayerStore.toggleRepeat()}
					aria-label="Toggle repeat"
				>
					{#if playerState.repeat === 'one'}
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
							<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
						</svg>
					{:else}
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
							<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
						</svg>
					{/if}
				</button>

				<!-- Close -->
				<button
					class="text-text-muted hover:text-text-primary p-1.5 transition-colors"
					onclick={() => musicPlayerStore.close()}
					aria-label="Close player"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}

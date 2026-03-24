<script lang="ts">
	interface Props {
		title: string;
		message: string;
		confirmLabel?: string;
		destructive?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		title,
		message,
		confirmLabel = 'Confirm',
		destructive = false,
		onConfirm,
		onCancel
	}: Props = $props();
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-40 bg-black/60"
	role="presentation"
	onclick={onCancel}
></div>

<!-- Dialog -->
<div
	class="bg-surface border-border fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-xl"
	role="dialog"
	aria-modal="true"
	aria-labelledby="confirm-title"
>
	<h2 id="confirm-title" class="text-text-primary mb-3 text-lg font-semibold">{title}</h2>
	<p class="text-text-secondary mb-6 text-sm leading-relaxed">{message}</p>
	<div class="flex justify-end gap-3">
		<button
			class="border-border text-text-secondary hover:text-text-primary rounded-lg border px-4 py-2 text-sm"
			onclick={onCancel}
		>
			Cancel
		</button>
		<button
			class="rounded-lg px-4 py-2 text-sm font-medium text-white {destructive
				? 'bg-error hover:opacity-90'
				: 'bg-accent hover:bg-accent-hover'}"
			onclick={onConfirm}
		>
			{confirmLabel}
		</button>
	</div>
</div>

<script lang="ts">
	let { class: klass = '' }: { class?: string } = $props();
</script>
<svg class={klass} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
	<rect x="3" y="4" width="18" height="4" rx="1"/>
	<rect x="3" y="8" width="18" height="12" rx="1"/>
	<line x1="7" y1="4" x2="6" y2="8"/>
	<line x1="12" y1="4" x2="11" y2="8"/>
	<line x1="17" y1="4" x2="16" y2="8"/>
</svg>

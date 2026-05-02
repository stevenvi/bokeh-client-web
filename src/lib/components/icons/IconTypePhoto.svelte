<script lang="ts">
	let { class: klass = '' }: { class?: string } = $props();
</script>
<svg class={klass} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
	<rect x="2" y="3" width="20" height="18" rx="2"/>
	<circle cx="8.5" cy="9.5" r="1.5"/>
	<path d="M3 17 l4-4 3 3 4-4.5 7 5.5"/>
</svg>

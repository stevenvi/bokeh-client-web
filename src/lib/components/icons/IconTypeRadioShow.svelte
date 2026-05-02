<script lang="ts">
	let { class: klass = '' }: { class?: string } = $props();
</script>
<svg class={klass} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
	<circle cx="12" cy="6" r="1.15" fill="currentColor" stroke="none"/>
	<path d="M 9.84,4.75 A 2.5,2.5 0 0,1 14.16,4.75" stroke-width="0.5"/>
	<path d="M 8.1,3.75 A 4.5,4.5 0 0,1 15.9,3.75" stroke-width="0.5"/>
	<line x1="12" y1="7.5" x2="5" y2="22"/>
	<line x1="12" y1="7.5" x2="19" y2="22"/>
	<line x1="9.3" y1="13" x2="17.1" y2="18" stroke-width="1"/>
	<line x1="14.7" y1="13" x2="6.9" y2="18" stroke-width="1"/>
	<line x1="6.9" y1="18" x2="19" y2="22" stroke-width="1"/>
	<line x1="17.1" y1="18" x2="5" y2="22" stroke-width="1"/>
</svg>

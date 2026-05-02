<script lang="ts">
	let { class: klass = '' }: { class?: string } = $props();
	const id = $props.id();
</script>
<svg class={klass} viewBox="0 0 24 24" fill="currentColor">
	<defs>
		<mask id="film-mask-{id}">
			<rect width="24" height="24" fill="black" />
			<rect x="2" y="4" width="20" height="16" rx="1.25" fill="white" />
			<rect x="3.25" y="7.5" width="17.5" height="9" fill="black" />
			<rect x="3.6" y="4.85" width="3" height="1.8" rx="0.5" fill="black" />
			<rect x="8.2" y="4.85" width="3" height="1.8" rx="0.5" fill="black" />
			<rect x="12.8" y="4.85" width="3" height="1.8" rx="0.5" fill="black" />
			<rect x="17.4" y="4.85" width="3" height="1.8" rx="0.5" fill="black" />
			<rect x="3.6" y="17.35" width="3" height="1.8" rx="0.5" fill="black" />
			<rect x="8.2" y="17.35" width="3" height="1.8" rx="0.5" fill="black" />
			<rect x="12.8" y="17.35" width="3" height="1.8" rx="0.5" fill="black" />
			<rect x="17.4" y="17.35" width="3" height="1.8" rx="0.5" fill="black" />
		</mask>
	</defs>
	<rect x="2" y="4" width="20" height="16" rx="1.25" mask="url(#film-mask-{id})" />
</svg>

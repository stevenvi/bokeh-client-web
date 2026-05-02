<script lang="ts">
	interface Props {
		query: string;
	}

	let { query }: Props = $props();
</script>

<p class="text-text-secondary p-6 text-center">No results for "{query}".</p>

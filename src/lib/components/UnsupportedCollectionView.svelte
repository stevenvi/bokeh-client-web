<script lang="ts">
	import { IconQuestionCircle } from './icons';

	interface Props {
		collectionName: string;
		collectionType: string;
	}

	let { collectionName, collectionType }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center px-4 py-24 text-center">
	<IconQuestionCircle class="text-text-muted mb-4 h-16 w-16" />
	<h2 class="text-text-primary mb-2 text-xl font-semibold">{collectionName}</h2>
	<p class="text-text-secondary text-sm">
		This content type (<code class="text-text-secondary">{collectionType}</code>) is not yet available.
	</p>
</div>

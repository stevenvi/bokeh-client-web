import type { BreadcrumbEntry } from '$lib/stores/navigation';

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		interface PageState {
			breadcrumbs?: BreadcrumbEntry[];
		}
		// interface Platform {}
	}
}

export {};

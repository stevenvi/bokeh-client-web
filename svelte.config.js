import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
// Warning codes silenced globally (read by svelte-check and the build).
// Add more codes here to suppress them everywhere without inline ignores.
const suppressedWarnings = ['a11y_'];

function isSuppressed(code) {
	return suppressedWarnings.some((prefix) => code.startsWith(prefix));
}

const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		warningFilter: (warning) => !isSuppressed(warning.code)
	},
	onwarn(warning, defaultHandler) {
		if (isSuppressed(warning.code)) return;
		defaultHandler(warning);
	},
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: false
		}),
		alias: {
			$lib: './src/lib'
		}
	}
};

export default config;

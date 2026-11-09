import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			fallback: '200.html',
			strict: false
		}),
		alias: {
			// The UI8Kit registry tree exactly as `npx ui8kit init` + `add` writes it (docs/adr/0001).
			$registry: '../../registry/svelte/src'
		}
	}
};

export default config;

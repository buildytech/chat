import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// BUILDY_BUILD_DIR: a second build (the chat-off no-trace check) beside the default one.
			pages: process.env.BUILDY_BUILD_DIR || 'build',
			assets: process.env.BUILDY_BUILD_DIR || 'build',
			fallback: '200.html',
			strict: false
		}),
		alias: {
			// The UI8Kit registry tree exactly as `npx ui8kit init` + `add` writes it (docs/adr/0001).
			$registry: '../../registry/svelte/src',
			// Optional builder modules (src/modules/<name>); core code reaches them only through lib/modules (ADR 0041).
			$modules: 'src/modules'
		}
	}
};

export default config;

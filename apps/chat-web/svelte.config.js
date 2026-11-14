import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readBuildConfig } from './config.js';

const { buildDir } = readBuildConfig(process.env);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// BUILDY_BUILD_DIR: a second build (the chat-off no-trace check) beside the default one.
			pages: buildDir,
			assets: buildDir,
			fallback: '200.html',
			strict: false
		}),
		// Content-Security-Policy of the app shell (ADR 0043): SvelteKit puts the hash of its one inline bootstrap script into a
		// <meta> policy of every page, the fallback included. frame-ancestors cannot be set by a meta tag; vercel.json sends it.
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				// unsafe-eval: Ajv compiles the props schemas with new Function in the browser (the props gate); precompiling them is the way to drop it.
				'script-src': ['self', 'unsafe-eval'],
				'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
				'font-src': ['self', 'data:', 'https://fonts.gstatic.com'],
				'img-src': ['self', 'data:', 'blob:', 'https:'],
				'connect-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self']
			}
		},
		alias: {
			// The UI8Kit registry tree exactly as `npx ui8kit init` + `add` writes it (docs/adr/0001).
			$registry: '../../registry/svelte/src',
			// Optional builder modules (src/modules/<name>); core code reaches them only through lib/modules (ADR 0041).
			$modules: 'src/modules'
		}
	}
};

export default config;

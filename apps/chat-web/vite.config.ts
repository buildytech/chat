import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/** Loopback Session HTTP. Override with CONTEXT_SERVE_PROXY_TARGET when launching Vite. */
const contextServe =
	(typeof process !== 'undefined' && process.env?.CONTEXT_SERVE_PROXY_TARGET?.trim()) ||
	'http://127.0.0.1:18090';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '127.0.0.1',
		port: 5173,
		strictPort: true,
		proxy: {
			'/v1': {
				target: contextServe,
				changeOrigin: true
			},
			'/healthz': {
				target: contextServe,
				changeOrigin: true
			}
		}
	}
});

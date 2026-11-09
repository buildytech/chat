import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const xaiRuntime =
	(typeof process !== 'undefined' && process.env?.XAI_RUNTIME_PROXY_TARGET?.trim()) ||
	'http://127.0.0.1:18100';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '127.0.0.1',
		port: 5173,
		strictPort: true,
		proxy: {
			'/runtime': {
				target: xaiRuntime,
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/runtime/, '') || '/'
			}
		}
	}
});

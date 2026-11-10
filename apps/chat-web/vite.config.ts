import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

const xaiRuntime =
	(typeof process !== 'undefined' && process.env?.XAI_RUNTIME_PROXY_TARGET?.trim()) ||
	'http://127.0.0.1:18100';

// Session files (ADR 0015) name the app version and, on Vercel, the commit the build came from.
const commit = (typeof process !== 'undefined' && process.env?.VERCEL_GIT_COMMIT_SHA?.trim()) || '';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		__BUILDY_APP_VERSION__: JSON.stringify(pkg.version),
		__BUILDY_APP_COMMIT__: JSON.stringify(commit)
	},
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

import type { ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type ProxyOptions } from 'vite';
import pkg from './package.json' with { type: 'json' };

const xaiRuntime =
	(typeof process !== 'undefined' && process.env?.XAI_RUNTIME_PROXY_TARGET?.trim()) ||
	'http://127.0.0.1:18100';

const runtimeOfflineBody = JSON.stringify({
	runtime: 'xai-grok',
	ready: false,
	liveModel: false,
	code: 'xai_runtime_unreachable'
});

function isHttpResponse(res: ServerResponse | Socket): res is ServerResponse {
	return 'writeHead' in res;
}

/** Down runtime is an offline status, not Vite's plaintext 500. */
const configureRuntimeProxy: NonNullable<ProxyOptions['configure']> = (proxy) => {
	const softFail = (err: Error, _req: unknown, res: ServerResponse | Socket) => {
		if (!isHttpResponse(res)) {
			res.end();
			return;
		}
		if (res.headersSent || res.writableEnded) return;
		const refused = (err as NodeJS.ErrnoException).code === 'ECONNREFUSED';
		res.writeHead(refused ? 503 : 500, {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store'
		});
		res.end(
			refused
				? runtimeOfflineBody
				: JSON.stringify({
						runtime: 'xai-grok',
						ready: false,
						liveModel: false,
						code: 'xai_status_error'
					})
		);
	};
	proxy.on('error', softFail);
	// Vite registers its own error listener after configure() and always logs a stack.
	queueMicrotask(() => {
		for (const listener of proxy.listeners('error')) {
			if (listener !== softFail) proxy.removeListener('error', listener);
		}
	});
};

const runtimeProxy: ProxyOptions = {
	target: xaiRuntime,
	changeOrigin: true,
	rewrite: (path) => path.replace(/^\/runtime/, '') || '/',
	configure: configureRuntimeProxy
};

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
		proxy: { '/runtime': runtimeProxy }
	},
	preview: {
		proxy: { '/runtime': runtimeProxy }
	}
});

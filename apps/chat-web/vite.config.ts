import type { ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import { readBuildConfig } from './config.js';
import pkg from './package.json' with { type: 'json' };
import pins from '../../catalog/snapshot.config.json' with { type: 'json' };

// The one place the app reads its environment (config.js, 12-factor).
const base = readBuildConfig(process.env);
const xaiRuntime = base.runtimeProxyTarget;

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
const commit = base.commit;

export default defineConfig(({ mode }) => {
	// ADR 0041: VITE_MODULE_CHAT=0 builds the page builder without the chat module (default on); the process env wins over .env files.
	const env = loadEnv(mode, process.cwd(), 'VITE_');
	const chat = readBuildConfig(process.env, env).moduleChat;
	// The live-model runtime belongs to the chat: without it there is nothing to proxy.
	const proxy = chat ? { '/runtime': runtimeProxy } : undefined;
	return {
		plugins: [tailwindcss(), sveltekit()],
		define: {
			__BUILDY_APP_VERSION__: JSON.stringify(pkg.version),
			__BUILDY_APP_COMMIT__: JSON.stringify(commit),
			// The content pins of this build (catalog/snapshot.config.json), read here so the app imports nothing outside apps/chat-web.
			__BUILDY_PINS__: JSON.stringify({ stock: { repo: pins.codegenX.repo, contentCommit: pins.codegenX.commit }, registry: { url: pins.ui8kit.registry, sourceCommit: pins.ui8kit.sourceCommit } }),
			__MODULE_CHAT__: JSON.stringify(chat)
		},
		server: {
			host: '127.0.0.1',
			port: 5173,
			strictPort: true,
			proxy
		},
		preview: { proxy }
	};
});

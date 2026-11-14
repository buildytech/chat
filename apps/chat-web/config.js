/**
 * The one typed config of chat-web (12-factor, plan item 6, audit F-01). Build time only: the app reads no env at run time.
 * `vite.config.ts` and `svelte.config.js` call `readBuildConfig(process.env, fileEnv)`; nothing else in the app touches `process.env`
 * or `import.meta.env` (a test holds that). Every name read here is documented in `.env.example` (a test holds that too).
 * Plain JS with JSDoc because `svelte.config.js` loads it under Node 22 without a TypeScript loader.
 */

/**
 * @typedef {object} BuildConfig
 * @property {boolean} moduleChat       VITE_MODULE_CHAT: the chat module is built in (ADR 0041). Default on.
 * @property {string} runtimeProxyTarget XAI_RUNTIME_PROXY_TARGET: where dev / preview proxies /runtime (chat module only).
 * @property {string} buildDir          BUILDY_BUILD_DIR: output directory of the static build (a second build beside the default one).
 * @property {string} commit            VERCEL_GIT_COMMIT_SHA: the commit a Vercel build came from ("" elsewhere); named in session files.
 */

const OFF = new Set(["0", "false", "off", "no"]);

/** `VITE_MODULE_CHAT` is on unless set to 0, false, off or no (any case). */
export function moduleEnabled(/** @type {string | undefined} */ value) {
	return !OFF.has((value ?? "").trim().toLowerCase());
}

const text = (/** @type {string | undefined} */ value) => (value ?? "").trim();

/**
 * @param {Record<string, string | undefined>} env   the process env (wins)
 * @param {Record<string, string | undefined>} [fileEnv]   VITE_* values of the .env files (vite `loadEnv`)
 * @returns {BuildConfig}
 */
export function readBuildConfig(env, fileEnv = {}) {
	return {
		moduleChat: moduleEnabled(env.VITE_MODULE_CHAT ?? fileEnv.VITE_MODULE_CHAT),
		runtimeProxyTarget: text(env.XAI_RUNTIME_PROXY_TARGET) || "http://127.0.0.1:18100",
		buildDir: text(env.BUILDY_BUILD_DIR) || "build",
		commit: text(env.VERCEL_GIT_COMMIT_SHA)
	};
}

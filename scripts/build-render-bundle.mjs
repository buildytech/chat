/**
 * Render probe bundle (ADR 0035): every registry block compiled for SSR with the same Svelte compiler the preview uses and
 * inlined with the Svelte server runtime into one dependency-free ES module, api/runtime/_render/blocks.mjs
 * (underscore: Vercel deploys it as a file of the function, not as a route). The runtime renders each block of a
 * write_page with it, so a page that would throw or show nothing in the preview is rejected with a path.
 * Generated, never committed (.gitignore); `npm run bundle:runtime` and the Vercel build command make it. A copy goes to
 * apps/chat-web/static/render/ so the browser can load the same blocks (the browser render probe, ADR 0038); the chat-web
 * `predev` and `prebuild` scripts make it too.
 */
import { copyFileSync, mkdirSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const registry = realpathSync(join(repo, "registry", "svelte"));
const outDir = join(repo, "api", "runtime", "_render");
const blocksDir = join(registry, "src", "blocks");
const files = readdirSync(blocksDir).filter((name) => name.endsWith(".svelte")).sort();

const scratch = join(repo, "node_modules", ".cache", "render-bundle");
mkdirSync(scratch, { recursive: true });
const entry = join(scratch, "entry.js");
writeFileSync(
	entry,
	[
		...files.map((name, i) => `import b${i} from ${JSON.stringify(join(blocksDir, name))};`),
		`export const blocks = { ${files.map((name, i) => `${JSON.stringify(`blocks/${name}`)}: b${i}`).join(", ")} };`,
		`export { render } from "svelte/server";`,
		""
	].join("\n")
);

await build({
	root: registry,
	configFile: false,
	logLevel: "warn",
	plugins: [svelte()],
	ssr: { noExternal: true },
	build: {
		ssr: entry,
		outDir,
		emptyOutDir: true,
		minify: false,
		rollupOptions: { output: { format: "esm", entryFileNames: "blocks.mjs" } }
	}
});
// The browser probe (ADR 0038) loads the same file as a static asset of the site: apps/chat-web/static/render/blocks.mjs (gitignored).
const staticDir = join(repo, "apps", "chat-web", "static", "render");
mkdirSync(staticDir, { recursive: true });
copyFileSync(join(outDir, "blocks.mjs"), join(staticDir, "blocks.mjs"));
console.log(`render bundle: ${files.length} blocks -> api/runtime/_render/blocks.mjs, apps/chat-web/static/render/blocks.mjs`);

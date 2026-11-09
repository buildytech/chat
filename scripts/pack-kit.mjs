/**
 * Chat components the ZIP vendors for the generic (non-registry) blocks, and exact npm versions for its package.json.
 *
 *   node scripts/pack-kit.mjs           write apps/chat-web/src/lib/page-store/pack-kit.json
 *   node scripts/pack-kit.mjs --check   fail when pack-kit.json is stale
 *
 * Entries are the `$lib/...` and `$ui/...` imports svelte-code.ts can emit; their import graph (relative, $lib, $ui)
 * is followed transitively. Bare imports become npm dependencies, pinned to the installed version.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "apps/chat-web/src");
const EMITTER = join(SRC, "lib/page-store/svelte-code.ts");
const OUT = join(SRC, "lib/page-store/pack-kit.json");
/** Build tooling of the exported project (vite.config.ts). */
const TOOLING = ["vite", "@sveltejs/vite-plugin-svelte", "tailwindcss", "@tailwindcss/vite"];
const sourcesNpm = JSON.parse(readFileSync(join(ROOT, "packages/builder-core/src/catalog/sources.json"), "utf8")).npmDependencies;

const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$|<!--[\s\S]*?-->/gm, "");
const importsOf = (code) => [...stripComments(code).matchAll(/(?:from\s+|import\s+)"([^"]+)"/g)].map((m) => m[1]);

function toSrcPath(specifier, fromPath) {
	if (specifier.startsWith("$lib/")) return `lib/${specifier.slice(5)}`;
	if (specifier.startsWith("$ui/")) return `ui/${specifier.slice(4)}`;
	if (specifier.startsWith(".")) return posix.normalize(posix.join(posix.dirname(fromPath), specifier));
	return null;
}

function resolveFile(path) {
	for (const candidate of [path, `${path}.ts`, `${path}.js`, `${path}/index.ts`, `${path}/index.js`]) {
		if (existsSync(join(SRC, candidate)) && !candidate.endsWith("/")) {
			try {
				readFileSync(join(SRC, candidate));
				return candidate;
			} catch {}
		}
	}
	return null;
}

const bareName = (specifier) => (specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]);

function build() {
	const emitter = readFileSync(EMITTER, "utf8");
	const entries = [...new Set([...emitter.matchAll(/"(\$(?:lib|ui)\/[^"]+)"/g)].map((m) => m[1]))].sort();
	const files = {};
	const npm = new Set();
	const queue = entries.map((specifier) => toSrcPath(specifier, ""));
	while (queue.length) {
		const wanted = queue.shift();
		const path = resolveFile(wanted);
		if (!path) throw new Error(`pack kit: cannot resolve ${wanted}`);
		if (files[path] !== undefined) continue;
		const code = readFileSync(join(SRC, path), "utf8");
		files[path] = code;
		if (!/\.(svelte|ts|js)$/.test(path)) continue;
		for (const specifier of importsOf(code)) {
			const local = toSrcPath(specifier, path);
			if (local) queue.push(local);
			else if (specifier.startsWith("$")) throw new Error(`pack kit: ${path} imports ${specifier} (not available outside the chat)`);
			else npm.add(bareName(specifier));
		}
	}
	npm.add("svelte");
	for (const name of sourcesNpm) npm.add(name);
	const version = (name) => {
		for (const base of [join(SRC, "..", "node_modules"), join(ROOT, "node_modules")]) {
			const manifest = join(base, name, "package.json");
			if (existsSync(manifest)) return JSON.parse(readFileSync(manifest, "utf8")).version;
		}
		throw new Error(`pack kit: ${name} is not installed`);
	};
	const dependencies = Object.fromEntries([...npm].sort().map((name) => [name, version(name)]));
	const devDependencies = Object.fromEntries(TOOLING.map((name) => [name, version(name)]));
	const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
	return `${JSON.stringify({ format: "buildy-pack-kit", version: 1, entries, dependencies, devDependencies, files: sorted }, null, "\t")}\n`;
}

const next = build();
if (process.argv.includes("--check")) {
	const ok = existsSync(OUT) && readFileSync(OUT, "utf8") === next;
	console.log(ok ? "pack-kit.json is current" : "pack-kit.json is stale: run node scripts/pack-kit.mjs");
	process.exit(ok ? 0 : 1);
}
writeFileSync(OUT, next);
const parsed = JSON.parse(next);
console.log(`${Object.keys(parsed.files).length} files; dependencies ${Object.keys(parsed.dependencies).join(", ")}`);

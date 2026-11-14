/**
 * Module boundary rules (ADR 0041), checked on source text: the builder core never reaches into an optional module,
 * modules do not reach into each other, and every message key belongs to exactly one catalog (core or module).
 * Pure functions over the repo tree; `scripts/check-modules.mjs` runs them, a unit test runs them too.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

export const WEB_SRC = "apps/chat-web/src";

export function walk(dir, accept = () => true) {
	const out = [];
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) out.push(...walk(path, accept));
		else if (accept(path)) out.push(path);
	}
	return out;
}

export const isSource = (path) => /\.(ts|svelte|js)$/.test(path) && !path.endsWith(".d.ts");

/** Names of the module folders under src/modules. */
export function moduleNames(root) {
	const dir = join(root, WEB_SRC, "modules");
	if (!existsSync(dir)) return [];
	return readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory());
}

/** Module specifiers a source file imports or re-exports (static, dynamic, `$modules` alias included). */
export function specifiersOf(text) {
	const out = [];
	const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;
	for (const match of text.matchAll(pattern)) out.push(match[1]);
	return out;
}

/** Everything in apps/chat-web/src outside modules/<name>/, except the loader (modules/index.ts) that names the modules. */
export function coreFiles(root) {
	const base = join(root, WEB_SRC);
	return walk(base, isSource).filter((path) => {
		const rel = relative(base, path).replaceAll("\\", "/");
		return !(rel.startsWith("modules/") && rel !== "modules/index.ts");
	});
}

/** True when `spec` (the `$modules` alias or a relative path) points into src/modules (not the port in lib/modules). */
function reachesModules(file, spec, base) {
	if (spec.startsWith("$modules")) return true;
	return spec.startsWith(".") && resolve(dirname(file), spec).startsWith(join(base, "modules") + sep);
}

export function boundaryViolations(root) {
	const problems = [];
	const names = moduleNames(root);
	const base = join(root, WEB_SRC);
	for (const path of coreFiles(root)) {
		const rel = relative(base, path).replaceAll("\\", "/");
		if (rel === "modules/index.ts") continue;
		for (const spec of specifiersOf(readFileSync(path, "utf8"))) {
			if (reachesModules(path, spec, base)) problems.push(`${rel}: core imports a module (${spec})`);
			if (spec.startsWith("@buildytech/chat-agent")) problems.push(`${rel}: core imports the chat agent package (${spec})`);
		}
	}
	for (const name of names) {
		const dir = join(base, "modules", name);
		for (const path of walk(dir, isSource)) {
			const rel = relative(base, path).replaceAll("\\", "/");
			for (const spec of specifiersOf(readFileSync(path, "utf8"))) {
				for (const other of names.filter((n) => n !== name)) {
					const target = join(base, "modules", other);
					const into = spec.startsWith(`$modules/${other}`) || (spec.startsWith(".") && (resolve(dirname(path), spec) + sep).startsWith(target + sep));
					if (into) problems.push(`${rel}: module ${name} imports module ${other} (${spec})`);
				}
			}
		}
	}
	return problems;
}

const readMessages = (path) => JSON.parse(readFileSync(path, "utf8")).messages;
const readOverrides = (path) => JSON.parse(readFileSync(path, "utf8")).overrides ?? {};

/** The message catalogs: core (lib/i18n) and each module (modules/<name>/i18n), en and ru. */
export function catalogs(root) {
	const base = join(root, WEB_SRC);
	const core = { en: readMessages(join(base, "lib/i18n/en.json")), ru: readMessages(join(base, "lib/i18n/ru.json")) };
	const modules = {};
	for (const name of moduleNames(root)) {
		const dir = join(base, "modules", name, "i18n");
		if (existsSync(join(dir, "en.json"))) {
			modules[name] = {
				en: readMessages(join(dir, "en.json")),
				ru: readMessages(join(dir, "ru.json")),
				overrides: { en: readOverrides(join(dir, "en.json")), ru: readOverrides(join(dir, "ru.json")) }
			};
		}
	}
	return { core, modules };
}

/** A key is in one catalog only, en and ru have the same keys, and core code never names a module's key. */
export function i18nViolations(root) {
	const problems = [];
	const { core, modules } = catalogs(root);
	const same = (label, a, b) => {
		for (const key of Object.keys(a)) if (!(key in b)) problems.push(`${label}: key in en but not in ru: ${key}`);
		for (const key of Object.keys(b)) if (!(key in a)) problems.push(`${label}: key in ru but not in en: ${key}`);
	};
	same("core", core.en, core.ru);
	const owner = new Map(Object.keys(core.en).map((key) => [key, "core"]));
	for (const [name, catalog] of Object.entries(modules)) {
		same(name, catalog.en, catalog.ru);
		same(`${name} overrides`, catalog.overrides.en, catalog.overrides.ru);
		for (const key of Object.keys(catalog.overrides.en)) if (!(key in core.en)) problems.push(`${key}: ${name} overrides a key the core does not have`);
		for (const key of Object.keys(catalog.en)) {
			if (owner.has(key)) problems.push(`${key}: in the ${name} catalog and in ${owner.get(key)}`);
			owner.set(key, name);
		}
	}
	const base = join(root, WEB_SRC);
	for (const path of coreFiles(root)) {
		const rel = relative(base, path).replaceAll("\\", "/");
		const text = readFileSync(path, "utf8");
		for (const [key, name] of owner) {
			if (name === "core") continue;
			if (new RegExp(`["'\`]${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`]`).test(text)) problems.push(`${rel}: core code uses the ${name} key ${key}`);
		}
	}
	return problems;
}

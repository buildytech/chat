/**
 * Dead code checks of the gate (plan item 6, audit B-08 to B-11), source-text based and conservative (a hit anywhere counts as a use):
 *   i18n    message keys of lib/i18n and modules/*\/i18n that no source file names (a template key `t(`a.${x}`)` keeps its prefix)
 *   files   source files nothing imports (routes, hooks, entry points and `.d.ts` excluded)
 *   exports named exports that no other file mentions (a word match anywhere, tests and scripts included; `export *` re-exports are followed by name)
 * Both are ratcheted in scripts/ratchet-baseline.json (`unusedI18nKeys`, `deadFiles`, `unusedExports`), which may only go down.
 *   node scripts/check-dead.mjs [--list]      check (and print the findings with --list)
 *   node scripts/check-dead.mjs --update      lower the baseline
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WEB_SRC, catalogs, isSource, walk } from "./lib/module-boundary.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baselineFile = join(root, "scripts/ratchet-baseline.json");
const read = (p) => readFileSync(p, "utf8");

const SCAN = ["apps/chat-web/src", "apps/xai-runtime/src", "packages/builder-core/src", "packages/chat-agent/src", "packages/page-contract/src", "packages/ports/src"];
const scanFiles = () => SCAN.flatMap((dir) => walk(join(root, dir), (p) => /\.(ts|svelte|mjs|js)$/.test(p)));

export function unusedI18nKeys() {
	const { core, modules } = catalogs(root);
	const keys = new Set([...Object.keys(core.en), ...Object.values(modules).flatMap((m) => Object.keys(m.en))]);
	const text = [...scanFiles(), ...walk(join(root, "scripts/m4-api-tests"), (p) => p.endsWith(".ts"))].filter((p) => !/\/i18n\//.test(p)).map(read).join("\n");
	const prefixes = [...text.matchAll(/`([A-Za-z][\w.]*\.)\$\{/g)].map((m) => m[1]);
	return [...keys].filter((key) => !text.includes(`"${key}"`) && !text.includes(`'${key}'`) && !text.includes(`\`${key}\``) && !prefixes.some((prefix) => key.startsWith(prefix))).sort();
}

export function unusedExports() {
	const files = scanFiles().filter((p) => /\.(ts|svelte)$/.test(p) && !p.endsWith(".d.ts") && !/\.test\.ts$/.test(p));
	const texts = new Map([...scanFiles(), ...walk(join(root, "scripts"), (p) => /\.(ts|mjs|js)$/.test(p)), ...walk(join(root, "apps/chat-web/src"), (p) => p.endsWith(".svelte"))].map((p) => [p, read(p)]));
	const out = [];
	for (const file of files) {
		if (/\/routes\//.test(file) || /\/index\.ts$/.test(file)) continue;
		const text = texts.get(file) ?? read(file);
		const names = new Set([...text.matchAll(/^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));
		for (const name of names) {
			const used = [...texts].some(([path, other]) => path !== file && new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`).test(other));
			if (!used) out.push(`${relative(root, file)}: ${name}`);
		}
	}
	return out.sort();
}

export function deadFiles() {
	const all = scanFiles().filter((p) => /\.(ts|svelte)$/.test(p) && !p.endsWith(".d.ts") && !/\.test\.ts$/.test(p));
	const texts = new Map(scanFiles().concat(walk(join(root, "scripts"), (p) => /\.(ts|mjs)$/.test(p))).map((p) => [p, read(p)]));
	const entry = (p) => /\/routes\//.test(p) || /hooks\.client\.ts$/.test(p) || /\/xai-runtime\/src\/(server|status|vercel-fetch)\.ts$/.test(p) || /\/index\.ts$/.test(p);
	return all.filter((file) => {
		if (entry(file)) return false;
		const name = file.replace(/^.*\//, "").replace(/\.(ts|svelte)$/, "");
		const stem = name.replace(/\.svelte$/, "");
		for (const [path, text] of texts) {
			if (path === file) continue;
			// an import of `.../name`, `.../name.ts`, `.../name.svelte`, `.../name.svelte.ts`
			if (new RegExp(`from\\s+["'][^"']*\\/${stem.replace(/\./g, "\\.")}(?:\\.svelte)?(?:\\.ts)?["']|import\\(["'][^"']*\\/${stem.replace(/\./g, "\\.")}`).test(text)) return false;
		}
		return true;
	});
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const found = { unusedI18nKeys: unusedI18nKeys(), deadFiles: deadFiles().map((p) => relative(root, p)), unusedExports: unusedExports() };
	const baseline = JSON.parse(read(baselineFile));
	const over = [], lower = {};
	for (const [key, list] of Object.entries(found)) {
		console.log(`dead ${key}: ${list.length} (baseline ${baseline[key] ?? "none"})`);
		if (process.argv.includes("--list")) for (const item of list) console.log(`  ${item}`);
		if (baseline[key] === undefined || list.length < baseline[key]) lower[key] = list.length;
		else if (list.length > baseline[key]) over.push(`${key} is ${list.length}, the baseline is ${baseline[key]}`);
	}
	if (process.argv.includes("--update")) writeFileSync(baselineFile, JSON.stringify({ ...baseline, ...lower }, null, "\t") + "\n");
	else if (over.length) { console.error(`dead code went up: ${over.join("; ")}`); process.exit(1); }
}

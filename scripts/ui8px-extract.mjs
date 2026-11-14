/**
 * ui8px gate for the Svelte UI (plan item 6). `ui8px lint` reads `.html`, `.css`, `.templ` and `.go` only, so this script mirrors the
 * class sets of our `.svelte` files into `.ui8px/extract/*.html` (one `<i data-src="file:line" class="...">` per class set, as upstream
 * does) and runs the linter over the mirror.
 *   node scripts/ui8px-extract.mjs           extract and lint; fails when the 8+4 grid violations (UI8PX001) pass the ratchet in scripts/ratchet-baseline.json
 * The policy (.ui8px/policy) is the generated default with the `controls` scope (odd steps, the dense IDE of ADR 0017). Its UI8PX002 (unknown
 * utility class: `flex-1`, `border-b`, tokens) only says the default allow-list is not curated for this app, so it is reported, not gated.
 *   node scripts/ui8px-extract.mjs --extract extract only
 * Class sets: a static `class="..."` and the string literals inside `class={...}` / `cn(...)` / `cva(...)` calls in `<script>` or the
 * template. Template literals with `${}` and dynamic parts are skipped (they cannot be read statically).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { walk } from "./lib/module-boundary.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, ".ui8px/extract");
const SCOPES = ["apps/chat-web/src/app", "apps/chat-web/src/routes", "apps/chat-web/src/modules/chat/ui"];

const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const looksLikeClasses = (s) => /^[\w\-:/[\].%!#@()>&~,= .'"+*]+$/.test(s) && !/^\s*$/.test(s);

export function classSets(text) {
	const sets = [];
	for (const m of text.matchAll(/\bclass="([^"{}]*)"/g)) sets.push({ line: lineOf(text, m.index), value: m[1] });
	for (const m of text.matchAll(/\bclass=\{/g)) {
		let depth = 1, i = m.index + m[0].length;
		const start = i;
		while (i < text.length && depth) { const c = text[i++]; if (c === "{") depth++; else if (c === "}") depth--; }
		for (const s of text.slice(start, i - 1).matchAll(/(["'])((?:\\.|(?!\1)[^\\\n])*)\1/g)) if (looksLikeClasses(s[2]) && s[2].includes(" ") || /^[a-z][\w:/[\]-]*-[\w:/[\].-]+$/.test(s[2])) sets.push({ line: lineOf(text, m.index), value: s[2] });
	}
	for (const m of text.matchAll(/\b(?:cn|cva)\(([\s\S]*?)\)/g)) {
		for (const s of m[1].matchAll(/(["'])((?:\\.|(?!\1)[^\\\n])*)\1/g)) if (looksLikeClasses(s[2])) sets.push({ line: lineOf(text, m.index), value: s[2] });
	}
	return sets;
}

export function extract() {
	rmSync(out, { recursive: true, force: true });
	mkdirSync(out, { recursive: true });
	writeFileSync(join(out, ".gitignore"), "*\n");
	let files = 0, count = 0;
	for (const scope of SCOPES) {
		for (const path of walk(join(root, scope), (p) => p.endsWith(".svelte"))) {
			const text = readFileSync(path, "utf8");
			const rel = relative(root, path);
			const sets = classSets(text);
			if (!sets.length) continue;
			const target = join(out, rel.replace(/[\\/]/g, "__") + ".html");
			writeFileSync(target, sets.map((s) => `<i data-src="${esc(rel)}:${s.line}" class="${esc(s.value)}"></i>`).join("\n") + "\n");
			files++; count += sets.length;
		}
	}
	return { files, count };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const { files, count } = extract();
	console.log(`ui8px: ${count} class sets from ${files} Svelte files mirrored to .ui8px/extract`);
	if (!process.argv.includes("--extract")) {
		const run = spawnSync("npx", ["--no-install", "ui8px", "lint", ".ui8px/extract"], { cwd: root, encoding: "utf8" });
		mkdirSync(join(root, ".ui8px/reports"), { recursive: true });
		writeFileSync(join(root, ".ui8px/reports/last-lint.txt"), run.stdout);
		if (run.stderr.trim()) process.stderr.write(run.stderr);
		if (!/Violations:\s*\d+/.test(run.stdout)) { console.error("ui8px: could not read the lint result"); process.exit(1); }
		const violations = (run.stdout.match(/^\S+:\d+:\d+ UI8PX001 /gm) ?? []).length;
		console.log(`ui8px: full report in .ui8px/reports/last-lint.txt; ${(run.stdout.match(/^\S+:\d+:\d+ UI8PX002 /gm) ?? []).length} UI8PX002 (default allow-list gaps, not gated)`);
		const baseline = JSON.parse(readFileSync(join(root, "scripts/ratchet-baseline.json"), "utf8")).ui8pxGrid;
		if (violations > baseline) { console.error(`ui8px: ${violations} grid violations, the baseline is ${baseline} (it may only go down)`); process.exit(1); }
		console.log(`ui8px: ${violations} grid violations (baseline ${baseline})`);
	}
}

/**
 * Ratchet (plan item 6, audit D-03 to D-05, F-03): counts that may only go down.
 *   node scripts/check-ratchet.mjs            fail when a count is above scripts/ratchet-baseline.json
 *   node scripts/check-ratchet.mjs --update   lower the baseline to today's counts (never raises it)
 * Counted over the source of apps/chat-web, apps/xai-runtime and packages/* (tests excluded):
 *   asUnknownAs, asNever, asType     type assertions (`as unknown as T`, `as never`, any other `as T`, `as const` excluded)
 *   directLocalStorage               `localStorage` outside lib/browser/storage-v1.ts
 *   eslintWarnings                   warnings of `npm run lint` (errors fail the lint itself)
 * The ui8px grid count is held by scripts/ui8px-extract.mjs in the same file.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { walk } from "./lib/module-boundary.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "scripts/ratchet-baseline.json");
const SOURCE = ["apps/chat-web/src", "apps/xai-runtime/src", "packages/builder-core/src", "packages/chat-agent/src", "packages/page-contract/src", "packages/ports/src"];

export const sourceFiles = () => SOURCE.flatMap((dir) => walk(join(root, dir), (p) => /\.(ts|svelte)$/.test(p) && !/\.test\.ts$/.test(p)));

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

export function assertionCounts(text) {
	const code = stripComments(text).split("\n").filter((line) => !/^\s*(import|export)\b.*\bfrom\b/.test(line) && !/^\s*(import|export)\s*\{/.test(line)).join("\n");
	const unknownAs = (code.match(/\bas unknown as\b/g) ?? []).length;
	const never = (code.match(/\bas never\b/g) ?? []).length;
	const all = (code.match(/[)\]\w}>"'`]\s+as\s+(?!const\b)[A-Za-z_{(\[]/g) ?? []).length;
	return { asUnknownAs: unknownAs, asNever: never, asType: all - 2 * unknownAs - never };
}

export function counts() {
	const total = { asUnknownAs: 0, asNever: 0, asType: 0, directLocalStorage: 0 };
	for (const path of sourceFiles()) {
		const text = readFileSync(path, "utf8");
		const c = assertionCounts(text);
		for (const key of Object.keys(c)) total[key] += c[key];
		if (!path.endsWith("lib/browser/storage-v1.ts")) total.directLocalStorage += (stripComments(text).match(/(?<![\w"'.])localStorage\b(?!["'])/g) ?? []).length;
	}
	const lint = spawnSync("npx", ["--no-install", "eslint", "packages", "apps", "-f", "json"], { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
	total.eslintWarnings = JSON.parse(lint.stdout).reduce((n, f) => n + f.messages.filter((m) => m.severity === 1).length, 0);
	return total;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const baseline = JSON.parse(readFileSync(file, "utf8"));
	const now = counts();
	const over = [], lower = {};
	for (const [key, value] of Object.entries(now)) {
		const limit = baseline[key];
		console.log(`ratchet ${key}: ${value}${limit === undefined ? " (no baseline)" : ` (baseline ${limit})`}`);
		if (limit === undefined || value < limit) lower[key] = value;
		else if (value > limit) over.push(`${key} is ${value}, the baseline is ${limit}`);
	}
	if (process.argv.includes("--update")) {
		writeFileSync(file, JSON.stringify({ ...baseline, ...lower }, null, "\t") + "\n");
		console.log(`ratchet: baseline lowered for ${Object.keys(lower).join(", ") || "nothing"}`);
	} else if (over.length) {
		console.error(`ratchet: ${over.length} count(s) went up:\n  ${over.join("\n  ")}\n(fix the new ones; the baseline only goes down)`);
		process.exit(1);
	} else if (Object.keys(lower).length) console.log(`ratchet: ${Object.keys(lower).join(", ")} went down: run \`node scripts/check-ratchet.mjs --update\` to keep it`);
}

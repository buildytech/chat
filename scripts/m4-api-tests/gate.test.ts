/** The item 6 gate tooling: the ratchet counter and the ui8px class extractor (pure parts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { assertionCounts } from "../check-ratchet.mjs";
import { classSets } from "../ui8px-extract.mjs";

test("assertion counter: as unknown as, as never and other assertions; imports and `as const` are not counted", () => {
	const text = [
		'import { a as b } from "x";',
		'export { c as d } from "y";',
		"const x = raw as unknown as Foo;",
		"const y = value as never;",
		"const z = value as Record<string, unknown>;",
		"const k = [1] as const;",
		"// const w = ignored as Bar;",
		"const s = (event.target as HTMLInputElement).value;"
	].join("\n");
	assert.deepEqual(assertionCounts(text), { asUnknownAs: 1, asNever: 1, asType: 2 });
});

test("ui8px extractor reads static classes and the literals of class={...}, not template parts", () => {
	const text = ['<div class="flex gap-2 p-4">', '<span class={cn("text-sm", open && "font-medium", `x-${n}`)}>', "</span>", '<i class={active ? "bg-accent px-2" : "px-4"}></i>'].join("\n");
	const values = classSets(text).map((s) => s.value);
	assert.ok(values.includes("flex gap-2 p-4"));
	assert.ok(values.includes("bg-accent px-2") && values.includes("px-4"));
	assert.ok(!values.some((v) => v.includes("${")));
});

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const walkFiles = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walkFiles(join(dir, name)) : [join(dir, name)]));
const sourceOf = (dir: string) => walkFiles(join(ROOT, dir)).filter((p) => /\.(ts|js|mjs|svelte)$/.test(p) && !/\.test\.ts$/.test(p));

test("12-factor: the environment is read in the config modules and the entry points that hand it to them, nowhere else", () => {
	const allowed = new Set([
		"apps/chat-web/config.js", // the typed build config
		"apps/chat-web/vite.config.ts", // entry: hands process.env to readBuildConfig
		"apps/chat-web/svelte.config.js", // entry: same
		"apps/xai-runtime/src/config.ts", // the one read of the runtime process env
		"packages/chat-agent/src/env-map.ts" // readEnv(): the default bag when an entry passes none
	]);
	const reads = [...sourceOf("apps/chat-web/src"), ...sourceOf("apps/xai-runtime/src"), ...sourceOf("packages")]
		.filter((file) => /\bprocess\??\.env\b|\bimport\.meta\.env\b/.test(readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "")))
		.map((file) => relative(ROOT, file));
	const extra = reads.filter((file) => !allowed.has(file));
	assert.deepEqual(extra, [], "read the environment through a config module");
	for (const file of ["apps/chat-web/config.js", "apps/xai-runtime/src/config.ts"]) assert.ok(existsSync(join(ROOT, file)));
});

test("12-factor: every variable the app reads is documented in .env.example", () => {
	const example = readFileSync(join(ROOT, ".env.example"), "utf8");
	const files = ["apps/chat-web/config.js", ...sourceOf("apps/xai-runtime/src"), ...sourceOf("packages/chat-agent/src")];
	const names = new Set<string>();
	for (const file of files) for (const m of readFileSync(join(ROOT, file.startsWith("/") ? relative(ROOT, file) : file), "utf8").matchAll(/\benv\??\.([A-Z][A-Z0-9_]{4,})|"([A-Z][A-Z0-9_]{8,})"/g)) names.add((m[1] ?? m[2])!);
	assert.ok(names.size >= 10, `found the variable names (${names.size})`);
	for (const name of names) assert.match(example, new RegExp(`\\b${name}\\b`), `${name} is in .env.example`);
});

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parsePage } from "../../packages/page-contract/src/index.ts";
import { proposeLayout } from "../../packages/builder-core/src/index.ts";
import { svelteFromPage, sveltePackFiles } from "../../apps/chat-web/src/lib/page-store/svelte-code.ts";

const CHAT_WEB = fileURLToPath(new URL("../../apps/chat-web/", import.meta.url));
const SRC = path.join(CHAT_WEB, "src");
const fixture = JSON.parse(
	readFileSync(new URL("../../packages/page-contract/fixtures/north-harbor-kitchen.json", import.meta.url), "utf8")
) as unknown;
const page = parsePage(fixture);

type CompileFn = (
	source: string,
	options: { filename: string; generate: "client" }
) => { js: { code: string }; warnings: unknown[] };

function loadCompile(): CompileFn {
	const req = createRequire(path.join(CHAT_WEB, "package.json"));
	try {
		return req("svelte/compiler").compile as CompileFn;
	} catch (err) {
		throw new Error(
			`svelte/compiler is required to prove generated Code is runnable Svelte 5. Install workspace deps (npm ci). ${(err as Error).message}`
		);
	}
}

function kitFile(specifier: string): string | null {
	if (specifier.startsWith("$lib/")) return path.join(SRC, "lib", specifier.slice("$lib/".length));
	if (specifier.startsWith("$ui/")) return path.join(SRC, "ui", specifier.slice("$ui/".length));
	return null;
}

function assertPackImports(label: string, files: { path: string; content: string }[]): { path: string; content: string }[] {
	const pack = new Map(files.map((file) => [file.path, file.content]));
	const svelteFiles = files.filter((file) => file.path.endsWith(".svelte"));
	assert.ok(svelteFiles.some((file) => file.path === "page.svelte"), `${label}: missing page.svelte`);
	for (const file of svelteFiles) {
		const imports = [...file.content.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]!);
		assert.ok(imports.length > 0, `${label} ${file.path}: no imports`);
		for (const specifier of imports) {
			assert.equal(
				/placeholder|TODO|FIXME|not-implemented|nonexistent/i.test(specifier),
				false,
				`${label} ${file.path}: placeholder import ${specifier}`
			);
			if (specifier.startsWith("$lib/") || specifier.startsWith("$ui/")) {
				const disk = kitFile(specifier);
				assert.ok(disk && existsSync(disk), `${label} ${file.path}: missing primitive ${specifier}`);
				continue;
			}
			assert.ok(
				specifier.startsWith("./") || specifier.startsWith("../"),
				`${label} ${file.path}: unexpected import ${specifier}`
			);
			const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), specifier));
			assert.ok(
				pack.has(resolved),
				`${label} ${file.path}: import ${specifier} is not an emitted pack file (${resolved})`
			);
		}
	}
	return svelteFiles;
}

function assertPackCompiles(label: string, files: { path: string; content: string }[]): void {
	const compile = loadCompile();
	for (const file of assertPackImports(label, files)) {
		try {
			const result = compile(file.content, { filename: file.path, generate: "client" });
			assert.ok(result.js.code.length > 0, `${label} ${file.path}: compiler returned empty js`);
		} catch (err) {
			assert.fail(`${label} ${file.path}: svelte/compiler rejected emitted source: ${(err as Error).message}`);
		}
	}
}

test("Svelte Code describes the current page with UI8Kit imports", () => {
	const source = svelteFromPage(page, null);
	assert.match(source, /data-page-id="page-home"/);
	assert.match(source, /from "\$lib\/compose\/Block\.svelte"/);
	assert.match(source, /from "\.\/blocks\/block-hero\.svelte"/);
	assert.doesNotMatch(source, /\{layout /);
	assert.doesNotMatch(source, /page\.latte/);
});

test("Svelte pack files emit page.svelte not page.latte", () => {
	const files = sveltePackFiles(page, "block-hero");
	const names = files.map((file) => file.path);
	assert.ok(names.includes("page.svelte"));
	assert.ok(names.includes("blocks/block-hero.svelte"));
	assert.equal(names.includes("page.latte"), false);
	const hero = files.find((file) => file.path === "blocks/block-hero.svelte");
	assert.ok(hero);
	assert.match(hero!.content, /Harbor tables, seasonal plates/);
	assert.doesNotMatch(hero!.content, /\{\"Harbor tables, seasonal plates\"\}/);
	assert.match(hero!.content, /from "\$ui\/button\/Button\.svelte"/);
});

function dashboardPage() {
	const dash = proposeLayout({
		brief: "Create a Dashboard for Orders. No invented figures.",
		scenarioId: "dashboard",
		screenId: null,
		expectedRevision: 0,
		now: "2026-11-08T00:00:00.000Z"
	});
	assert.equal(dash.ok, true);
	if (!dash.ok) throw new Error("dashboard proposeLayout failed");
	return dash.page;
}

test("generated pack imports resolve to kit primitives and emitted files", () => {
	assertPackImports("north-harbor", sveltePackFiles(page, "block-hero"));
	assertPackImports("dashboard", sveltePackFiles(dashboardPage(), null));
});

test("generated page.svelte and block files compile as Svelte 5", () => {
	assertPackCompiles("north-harbor", sveltePackFiles(page, "block-hero"));
	assertPackCompiles("dashboard", sveltePackFiles(dashboardPage(), null));
});

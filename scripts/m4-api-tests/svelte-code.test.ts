import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parsePage } from "../../packages/page-contract/src/index.ts";
import { executeTool, proposeLayout, type LayoutProposal } from "../../packages/builder-core/src/index.ts";
import { RU_DEMO_PROMPT, ruDashboardArgs } from "./fixtures-demo.ts";
import { packNpmDependencies, svelteFromPage, sveltePackFiles } from "../../apps/chat-web/src/lib/page-store/svelte-code.ts";
import { packFilesFromPage } from "../../apps/chat-web/src/lib/page-store/pack.ts";

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

/** A relative import as the bundler resolves it: the file, or with .ts / .js, or the folder index. */
function packTarget(pack: Map<string, string>, resolved: string): string | null {
	for (const candidate of [resolved, `${resolved}.ts`, `${resolved}.js`, `${resolved}/index.ts`, `${resolved}/index.js`]) {
		if (pack.has(candidate)) return candidate;
	}
	return null;
}

function assertPackImports(
	label: string,
	files: { path: string; content: string }[],
	npm: string[] = []
): { path: string; content: string }[] {
	const pack = new Map(files.map((file) => [file.path, file.content]));
	const svelteFiles = files.filter((file) => file.path.endsWith(".svelte"));
	assert.ok(svelteFiles.some((file) => file.path === "page.svelte"), `${label}: missing page.svelte`);
	for (const file of files.filter((file) => /\.(svelte|ts)$/.test(file.path))) {
		const code = file.path.endsWith(".ts") ? file.content.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "") : file.content;
		const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]!);
		if (file.path.endsWith(".svelte")) assert.ok(imports.length > 0, `${label} ${file.path}: no imports`);
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
			const bare = specifier.split("/")[0]!;
			if (!specifier.startsWith(".") && npm.includes(bare)) continue;
			assert.ok(
				specifier.startsWith("./") || specifier.startsWith("../"),
				`${label} ${file.path}: unexpected import ${specifier}`
			);
			const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), specifier));
			assert.ok(
				packTarget(pack, resolved),
				`${label} ${file.path}: import ${specifier} is not an emitted pack file (${resolved})`
			);
		}
	}
	return svelteFiles;
}

function assertPackCompiles(label: string, files: { path: string; content: string }[], npm: string[] = []): void {
	const compile = loadCompile();
	for (const file of assertPackImports(label, files, npm)) {
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

function demoDashboardPage() {
	const result = executeTool(
		{ name: "propose_layout", arguments: ruDashboardArgs() },
		{ liveTurn: true, authorBrief: RU_DEMO_PROMPT }
	);
	assert.equal(result.ok, true);
	if (!result.ok) throw new Error("demo dashboard failed");
	return (result.result as LayoutProposal).page;
}

test("generated pack imports resolve to kit primitives and emitted files", () => {
	assertPackImports("north-harbor", sveltePackFiles(page, "block-hero"));
	assertPackImports("dashboard", sveltePackFiles(dashboardPage(), null));
	assertPackImports("demo-dashboard", sveltePackFiles(demoDashboardPage(), null));
});

test("generated page.svelte and block files compile as Svelte 5", () => {
	assertPackCompiles("north-harbor", sveltePackFiles(page, "block-hero"));
	assertPackCompiles("dashboard", sveltePackFiles(dashboardPage(), null));
	assertPackCompiles("demo-dashboard", sveltePackFiles(demoDashboardPage(), null));
});

test("demo dashboard Code renders values, bars, rows, and the demo badge", () => {
	const files = sveltePackFiles(demoDashboardPage(), null);
	const byPath = (path: string) => files.find((file) => file.path === path)?.content ?? "";
	assert.match(byPath("blocks/block-metrics.svelte"), /data-badge="demo"/);
	assert.match(byPath("blocks/block-metrics.svelte"), /grid grid-cols-2/);
	assert.match(byPath("blocks/block-metrics-item-1.svelte"), /94%/);
	assert.match(byPath("blocks/block-chart-item-2.svelte"), /bg-primary h-32/);
	assert.match(byPath("blocks/block-chart-item-3.svelte"), /bg-primary h-(?:8|12)"/);
	assert.doesNotMatch(files.map((file) => file.content).join("\n"), /style=/);
});

test("app shell pack: aside sidenav, main, mobile-only bottomnav, nav landmarks with aria-current", () => {
	const page = demoDashboardPage();
	const files = sveltePackFiles(page, null);
	const root = files.find((file) => file.path === "page.svelte")!.content;
	assert.match(root, /data-slot="app-shell"/);
	assert.match(root, /md:grid-cols-\[16rem_minmax\(0,1fr\)\]/);
	assert.match(root, /<Box tag="main"[^>]*data-slot="app-main"/);
	// Sidenav first, then main blocks, bottomnav last.
	assert.ok(root.indexOf("<Block_sidenav />") < root.indexOf('<Box tag="main"'));
	assert.ok(root.indexOf("<Block_bottomnav />") > root.indexOf("</Box>"));
	const side = files.find((file) => file.path === "blocks/block-sidenav.svelte")!.content;
	assert.match(side, /<Block tag="aside"/);
	assert.match(side, /<Box tag="nav" id="block-sidenav-links" aria-label="[^"]+"/);
	assert.match(side, /aria-expanded=\{open \? "true" : "false"\}/);
	assert.match(side, /aria-controls="block-sidenav-links"/);
	assert.match(side, /hidden md:block/);
	assert.equal([...side.matchAll(/<Block /g)].length, 1, "one Block per render path");
	const bottom = files.find((file) => file.path === "blocks/block-bottomnav.svelte")!.content;
	assert.match(bottom, /<Block tag="nav" class="[^"]*md:hidden[^"]*" aria-label="[^"]+"/);
	const firstLink = files.find((file) => file.path === "blocks/block-sidenav-link-1.svelte")!.content;
	assert.match(firstLink, /<Block tag="li"/);
	assert.match(firstLink, /<Link href="#block-sidenav-link-1"[^>]*aria-current="page"/);
	const secondLink = files.find((file) => file.path === "blocks/block-sidenav-link-2.svelte")!.content;
	assert.doesNotMatch(secondLink, /aria-current/);
	assertPackCompiles("app-shell", files);
	assertPackImports("app-shell", files);
});

function featuresPage(variant: string) {
	const result = executeTool(
		{
			name: "propose_layout",
			arguments: {
				brief: "Landing for a static site builder with a features grid",
				screenId: "screen.site/home",
				locale: "en",
				blocks: [
					{
						kind: "features",
						title: "Features of our service",
						variant,
						action: { label: "View all", href: "#/features" },
						items: [
							{ label: "Fast by default", detail: "Pages render from static data.", icon: "zap" },
							{ label: "Clear structure", detail: "One heading per page.", icon: "layers" },
							{ label: "Accessible", detail: "Landmarks and labels on every section.", icon: "accessibility" }
						]
					}
				]
			}
		},
		{ liveTurn: true, authorBrief: "Landing with features" }
	);
	assert.equal(result.ok, true, JSON.stringify(result));
	return (result.result as LayoutProposal).page;
}

test("feature-grid pack: the real registry organism with its deps and styles, imports resolve, compiles", () => {
	const page = featuresPage("cells4");
	const files = sveltePackFiles(page, null);
	const npm = packNpmDependencies(page);
	assert.deepEqual(npm, ["svelte", "clsx", "tailwind-merge"]);
	const byPath = new Map(files.map((file) => [file.path, file.content]));
	const block = byPath.get("blocks/block-features.svelte")!;
	assert.match(block, /import FeatureGrid from "\.\.\/ui8kit\/blocks\/feature-grid\.svelte"/);
	assert.match(block, /"item": "cell"/);
	assert.match(block, /"cols": "1-4"|"cols": "1-2"|"cols": "1-3"/);
	assert.match(block, /"icon": "zap"/);
	assert.match(block, /"href": "#\/features"/);
	assert.equal(byPath.has("blocks/block-features-item-1.svelte"), false, "the organism renders its rows");
	for (const style of ["index", "theme", "kit"]) assert.ok(byPath.has(`ui8kit/styles/${style}.css`), `styles/${style}.css`);
	assert.ok(byPath.has("ui8kit/blocks/feature-grid.svelte"));
	assertPackCompiles("feature-grid", files, npm);
	const pack = packFilesFromPage(page, null);
	const pkg = JSON.parse(pack.find((file) => file.path === "package.json")!.content) as { dependencies: Record<string, string> };
	assert.deepEqual(Object.keys(pkg.dependencies).sort(), ["clsx", "svelte", "tailwind-merge"]);
	const manifest = JSON.parse(pack.find((file) => file.path === "manifest.json")!.content) as { files: string[] };
	assert.ok(manifest.files.includes("ui8kit/blocks/feature-grid.svelte"));
});

test("pages without a registry block emit no registry tree and no package.json", () => {
	const files = packFilesFromPage(page, null);
	assert.equal(files.some((file) => file.path.startsWith("ui8kit/") || file.path === "package.json"), false);
});

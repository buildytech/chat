/**
 * Code pane + ZIP export: App.svelte and one section per page block, each section one UI8Kit registry block (or the
 * explicit "not in the registry" stub). The ZIP carries the registry files exactly as `ui8kit init` + `ui8kit add`
 * write them (read from the pinned CLI snapshot in registry/svelte), compiles, and builds with vite.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parsePage, type Page } from "../../packages/page-contract/src/index.ts";
import { executeTool, proposeLayout, registrySkins, SCENARIO_IDS, type LayoutProposal } from "../../packages/builder-core/src/index.ts";
import { APP_FILE, registryItemsOf, stubAlertImport, svelteFromPage, sveltePackFiles } from "../../apps/chat-web/src/lib/page-store/svelte-code.ts";
import {
	buildStoreZip,
	CLI_CONFIG,
	CLI_LOCK,
	PACK_DEPENDENCIES,
	PACK_DEV_DEPENDENCIES,
	packFilesFromPage,
	packZipFiles,
	type PackFile
} from "../../apps/chat-web/src/lib/page-store/pack.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SNAPSHOT = path.join(ROOT, "registry/svelte");
const NOW = "2026-11-09T00:00:00.000Z";
const fixture = parsePage(JSON.parse(readFileSync(path.join(ROOT, "packages/page-contract/fixtures/north-harbor-kitchen.json"), "utf8")));

/** Node stand-in for the browser's import.meta.glob reader: the pinned CLI snapshot on disk. */
async function readSnapshot(paths: string[]): Promise<Record<string, string>> {
	return Object.fromEntries(paths.map((file) => [file, readFileSync(path.join(SNAPSHOT, file), "utf8")]));
}

type CompileFn = (source: string, options: { filename: string; generate: "client" }) => { js: { code: string } };
const compile = createRequire(path.join(ROOT, "apps/chat-web/package.json"))("svelte/compiler").compile as CompileFn;

function scenarioPage(id: string): Page {
	const r = proposeLayout({ brief: `Create a ${id} for a bakery`, scenarioId: id as never, screenId: null, expectedRevision: 0, now: NOW });
	assert.ok(r.ok, `${id}: ${JSON.stringify(r)}`);
	return r.page;
}

function featuresPage(variant: string): Page {
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
							{ label: "Clear structure", detail: "One heading per page.", icon: "layers" }
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

/** Every relative import of a .svelte/.ts file resolves to a file of the pack; bare imports are declared npm deps. */
function assertSelfContained(label: string, files: PackFile[]): void {
	const pack = new Set(files.map((file) => file.path));
	const npm = new Set([...Object.keys(PACK_DEPENDENCIES), ...Object.keys(PACK_DEV_DEPENDENCIES)]);
	for (const file of files.filter((entry) => /\.(svelte|ts)$/.test(entry.path) && entry.path.startsWith("src/"))) {
		const code = file.content.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
		for (const [, spec] of code.matchAll(/(?:from|import)\s+"([^"]+)"/g)) {
			if (!spec!.startsWith(".")) {
				const bare = spec!.startsWith("@") ? spec!.split("/").slice(0, 2).join("/") : spec!.split("/")[0]!;
				assert.ok(npm.has(bare), `${label} ${file.path}: undeclared package ${spec}`);
				continue;
			}
			const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), spec!));
			const hit = [resolved, `${resolved}.ts`, `${resolved}.js`, `${resolved}/index.ts`, `${resolved}/index.js`].some((candidate) => pack.has(candidate));
			assert.ok(hit, `${label} ${file.path}: ${spec} is not in the pack`);
		}
		if (file.path.endsWith(".svelte")) assert.ok(compile(file.content, { filename: file.path, generate: "client" }).js.code.length > 0);
	}
}

test("Code: App.svelte lists one section per block; each section imports one registry block with its props", () => {
	const page = featuresPage("cells4");
	const app = svelteFromPage(page);
	assert.match(app, /import Block_features from "\.\/sections\/block-features\.svelte"/);
	const files = sveltePackFiles(page);
	assert.equal(files[0]!.path, APP_FILE);
	const section = files.find((file) => file.path.startsWith("src/sections/") && file.content.includes("feature-grid"))!;
	assert.match(section.content, /import FeatureGrid from "\.\.\/blocks\/feature-grid\.svelte"/);
	assert.match(section.content, /"cols": "1-4"|"cols": "1-2"|"cols": "1-3"/);
	assert.match(section.content, /"icon": "zap"/);
	assert.match(section.content, /"href": "#\/features"/);
	assert.doesNotMatch(files.map((file) => file.content).join("\n"), /\$lib\/|\$ui\/|lib\/compose|"\$":/);
	for (const file of files) assert.ok(compile(file.content, { filename: file.path, generate: "client" }).js.code.length > 0, file.path);
});

test("blocks without a registry item render the explicit stub (registry Alert), never a chat-made layout", () => {
	const files = sveltePackFiles(fixture);
	const sections = files.filter((file) => file.path.startsWith("src/sections/"));
	assert.equal(sections.length, fixture.layout.blocks.length);
	for (const section of sections) {
		assert.match(section.content, new RegExp(`import Alert from "${stubAlertImport().replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"`));
		assert.match(section.content, /data-slot="registry-stub"/);
	}
	assert.deepEqual(registryItemsOf(fixture), ["alert"]);
});

test("Landing, Website and Dashboard scenarios: every block is a registry block (0 stubs)", () => {
	for (const id of SCENARIO_IDS) {
		const page = scenarioPage(id);
		const stubs = sveltePackFiles(page).filter((file) => file.content.includes('data-slot="registry-stub"'));
		assert.deepEqual(stubs.map((file) => file.path), [], id);
	}
});

test("ZIP = CLI layout: config, lock subset and the closure of the page's items, self-contained, compiles", async () => {
	for (const [label, page] of [["features", featuresPage("grid")], ["dashboard", scenarioPage("dashboard")], ["fixture", fixture]] as const) {
		const files = await packZipFiles(page, readSnapshot);
		const paths = files.map((file) => file.path);
		assert.equal(new Set(paths).size, paths.length, `${label}: duplicate paths`);
		assert.equal(files.find((file) => file.path === CLI_CONFIG)!.content, readFileSync(path.join(SNAPSHOT, CLI_CONFIG), "utf8"));
		const lock = JSON.parse(files.find((file) => file.path === CLI_LOCK)!.content) as { items: Record<string, { name: string; files: Record<string, string> }> };
		const locked = Object.values(lock.items).flatMap((item) => Object.keys(item.files));
		const registryFiles = paths.filter((file) => file.startsWith("src/") && !file.startsWith("src/sections/") && file !== APP_FILE && file !== "src/main.ts");
		assert.deepEqual([...registryFiles].sort(), [...new Set(locked)].sort(), `${label}: registry files == lock files`);
		for (const item of ["presets", "recipes", "utils"]) assert.ok(Object.values(lock.items).some((entry) => entry.name === item), `${label}: init item ${item}`);
		const manifest = JSON.parse(files.at(-1)!.content) as { files: string[] };
		assert.deepEqual([...manifest.files].sort(), [...paths].sort(), `${label}: manifest lists the ZIP`);
		assertSelfContained(label, files);
	}
});

test("pack package.json pins exactly the versions installed in this workspace", () => {
	const pkg = JSON.parse(packFilesFromPage(fixture).find((file) => file.path === "package.json")!.content) as Record<string, Record<string, string>>;
	for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
		const installed = JSON.parse(readFileSync(path.join(ROOT, "node_modules", name, "package.json"), "utf8")) as { version: string };
		assert.equal(version, installed.version, name);
	}
	assert.deepEqual(pkg.scripts, { dev: "vite", build: "vite build", preview: "vite preview" });
});

/** Minimal ZIP (STORE) reader: the pack writes uncompressed entries. */
function unzipStore(bytes: Uint8Array): PackFile[] {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const out: PackFile[] = [];
	const decoder = new TextDecoder();
	let offset = 0;
	while (view.getUint32(offset, true) === 0x04034b50) {
		const size = view.getUint32(offset + 18, true);
		const nameLength = view.getUint16(offset + 26, true);
		const extra = view.getUint16(offset + 28, true);
		const nameStart = offset + 30;
		const dataStart = nameStart + nameLength + extra;
		out.push({ path: decoder.decode(bytes.subarray(nameStart, nameStart + nameLength)), content: decoder.decode(bytes.subarray(dataStart, dataStart + size)) });
		offset = dataStart + size;
	}
	return out;
}

test("mixed ZIP (registry blocks + stub, with a skin) unzips and builds with vite, styles include dark, responsive and skin rules", async () => {
	const page = scenarioPage("landing");
	const withStub: Page = { ...page, layout: { ...page.layout, blocks: [...page.layout.blocks, { ...fixture.layout.blocks[0]!, id: "block-legacy" }] } };
	const skin = registrySkins()[0]!;
	const entries = unzipStore(buildStoreZip(await packZipFiles(withStub, readSnapshot, { skin: skin.id })));
	const dir = mkdtempSync(path.join(tmpdir(), "buildy-pack-"));
	try {
		for (const entry of entries) {
			const target = path.join(dir, entry.path);
			assert.ok(target.startsWith(dir + path.sep), `zip path stays inside: ${entry.path}`);
			mkdirSync(path.dirname(target), { recursive: true });
			writeFileSync(target, entry.content);
		}
		// Offline stand-in for `npm i`: the workspace node_modules has the versions the pack pins (asserted above).
		symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"), "dir");
		const run = spawnSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--logLevel", "warn"], { cwd: dir, encoding: "utf8", timeout: 180_000 });
		assert.equal(run.status, 0, `vite build failed:\n${run.stdout}\n${run.stderr}`);
		const assets = path.join(dir, "dist/assets");
		const css = readFileSync(path.join(assets, readdirSync(assets).find((file) => file.endsWith(".css"))!), "utf8");
		assert.match(css, /\.dark/);
		assert.match(css, /md\\:/);
		assert.ok(css.includes(`[data-skin="${skin.id}"]`) || css.includes(`[data-skin=${skin.id}]`), "the skin CSS is in the build");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("exported code carries no preview attributes; the stub imports Alert from the path `npx ui8kit add alert` writes", async () => {
	const lock = JSON.parse(readFileSync(path.join(SNAPSHOT, "ui8kit.lock.json"), "utf8")) as { items: Record<string, { name: string; files: Record<string, string> }> };
	const alertFiles = Object.values(lock.items).filter((item) => item.name === "alert").flatMap((item) => Object.keys(item.files));
	assert.deepEqual(alertFiles.map((file) => `../${file.slice("src/".length)}`), [stubAlertImport()], "1:1 with the CLI install path");
	const page = scenarioPage("landing");
	const withStub: Page = { ...page, layout: { ...page.layout, blocks: [...page.layout.blocks, { ...fixture.layout.blocks[0]!, id: "block-legacy" }] } };
	const files = await packZipFiles(withStub, readSnapshot);
	const registry = new Set(Object.values(lock.items).flatMap((item) => Object.keys(item.files)));
	// BuildY-authored files: everything but the verbatim registry files and the CLI inventories (config, lock, manifest list real paths).
	const inventories = new Set([CLI_CONFIG, CLI_LOCK, "manifest.json"]);
	const generated = files.filter((file) => !registry.has(file.path) && !inventories.has(file.path));
	assert.ok(generated.some((file) => file.path === "src/sections/block-legacy.svelte"), "the stub section is in the pack");
	for (const file of generated) {
		for (const attr of ["data-block-id", "data-renderer", "data-registry-item", "data-variant"]) {
			assert.ok(!file.content.includes(attr), `${file.path} carries the preview attribute ${attr}`);
		}
		// "compose/" may appear only as the CLI install path of a registry import, never as BuildY's own naming.
		const leaks = file.content.split("\n").filter((line) => line.includes("compose/") && !line.includes(`from "${stubAlertImport()}"`));
		assert.deepEqual(leaks, [], `${file.path} leaks compose naming`);
	}
	// Registry files are verbatim CLI output (their own data-variant on a component is UI8Kit, not a preview attribute).
	for (const file of files.filter((f) => registry.has(f.path))) assert.ok(!/data-(block-id|renderer|registry-item)/.test(file.content), file.path);
});

test("skin: the ZIP carries theme-<skin> exactly as `npx ui8kit add theme-<skin>` writes it, imported and on", async () => {
	const lock = JSON.parse(readFileSync(path.join(SNAPSHOT, CLI_LOCK), "utf8")) as { items: Record<string, { name: string; type?: string; files: Record<string, string> }> };
	const skins = registrySkins();
	assert.ok(skins.length >= 2, "the pinned registry carries skins");
	const skin = skins.find((entry) => entry.id === "claude") ?? skins[0]!;
	const page = featuresPage("grid");
	const files = await packZipFiles(page, readSnapshot, { skin: skin.id });
	const byPath = new Map(files.map((file) => [file.path, file.content]));
	const themeItems = Object.values(lock.items).filter((item) => item.name === skin.item || item.name === "theme-base");
	assert.equal(themeItems.length, 2, "theme-<skin> + theme-base are in the CLI snapshot lock");
	for (const file of themeItems.flatMap((item) => Object.keys(item.files))) {
		assert.equal(byPath.get(file), readFileSync(path.join(SNAPSHOT, file), "utf8"), `${file} is byte-identical to the CLI install`);
	}
	const zipLock = JSON.parse(byPath.get(CLI_LOCK)!) as { items: Record<string, { name: string }> };
	for (const name of [skin.item, "theme-base"]) assert.ok(Object.values(zipLock.items).some((item) => item.name === name), `lock records ${name}`);
	assert.ok(registryItemsOf(page, skin.id).includes(skin.item), "the skin item is one of the page's registry items");
	assert.match(byPath.get("src/main.ts")!, new RegExp(`import "\\./${skin.file.slice("src/".length).replace(/[.]/g, "\\.")}";`));
	assert.ok(byPath.get("src/main.ts")!.indexOf("styles/index.css") < byPath.get("src/main.ts")!.indexOf(skin.file.slice("src/".length)), "skin after the styles entry");
	assert.match(byPath.get("index.html")!, new RegExp(`<html lang="en" data-skin="${skin.id}">`));
	const manifest = JSON.parse(byPath.get("manifest.json")!) as { skin: string | null; files: string[] };
	assert.equal(manifest.skin, skin.id);
	assert.deepEqual([...manifest.files].sort(), [...byPath.keys()].sort());
	assertSelfContained("skin", files);

	// Default theme and an id the registry does not carry: no theme files, no data-skin.
	for (const id of [null, "not-a-skin"]) {
		const plain = await packZipFiles(page, readSnapshot, { skin: id });
		assert.ok(!plain.some((file) => file.path.includes("/skins/")), `${id}: no skin files`);
		assert.ok(!plain.find((file) => file.path === "index.html")!.content.includes("data-skin"), `${id}: no data-skin`);
		assert.equal((JSON.parse(plain.find((file) => file.path === "manifest.json")!.content) as { skin: unknown }).skin, null);
	}
});

test("GENERATOR.json names the chat's real version", () => {
	const generator = JSON.parse(packFilesFromPage(fixture).find((file) => file.path === "GENERATOR.json")!.content) as { packageVersion: string };
	const version = (JSON.parse(readFileSync(path.join(ROOT, "apps/chat-web/package.json"), "utf8")) as { version: string }).version;
	assert.equal(generator.packageVersion, version);
	assert.notEqual(version, "0.0.0");
});

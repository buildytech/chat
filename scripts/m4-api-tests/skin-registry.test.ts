/**
 * One skin format, one registry, one deterministic apply (ADR 0074). The owner's switch between custom skins changed the
 * blocks "at random": an async race in how the skin reached the document. Plus compatibility with the Stock / Magazine
 * theme editor of codegen-x/ui8kit (format magazine-theme v2): real exports of its own `toConfig` go in as a regular skin,
 * come out unchanged, and a Design skin and an imported one are the same record in the same selector.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { configText, importStockExport, importThemeConfig, type ThemeConfig } from "../../apps/chat-web/src/lib/theme/custom-skin.ts";
import { brandSkinOf, brandSkinsOf, editedBrandSkin, importedSkinRecord, packSkinOptionsFor, themeOfProjectSkin, upsertBrandSkin, type BrandSkinRecord } from "../../apps/chat-web/src/lib/theme/brand-skins.ts";
import { createSkinApplier } from "../../apps/chat-web/src/lib/theme/skin-apply.ts";
import { skinSheets, skinSource, type SkinSource } from "../../apps/chat-web/src/lib/theme/skin-source.ts";
import { packFilesFromPage } from "../../apps/chat-web/src/lib/page-store/pack.ts";
import type { Project } from "../../apps/chat-web/src/lib/project/types.ts";
import { studioPage } from "./studio-page.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const REAL = fixture("ui8kit-theme-exports.json");
const web = (path: string): string => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");
const NOW = "2026-11-28T12:00:00.000Z";

function project(over: Partial<Project> = {}): Project {
	return { id: "session-1", projectId: "session-1", title: "New page", createdAt: NOW, updatedAt: NOW, ext: {}, ...over } as Project;
}

// ---- compatibility with the Stock / Magazine theme editor ------------------------------------------------------------

test("the fixtures are real exports of codegen-x/ui8kit's toConfig", () => {
	assert.equal(REAL.source.repo, "codegen-x/ui8kit");
	assert.match(REAL.source.commit, /^[0-9a-f]{7}$/);
	for (const config of Object.values<ThemeConfig>(REAL.exports)) assert.equal(config.format, "magazine-theme");
});

test("every real export imports as a regular skin and comes out unchanged (round trip)", () => {
	for (const [name, original] of Object.entries(REAL.exports)) {
		const read = importStockExport(JSON.stringify(original));
		assert.ok(read.ok, `${name}: ${read.ok ? "" : JSON.stringify(read.issues)}`);
		assert.deepEqual(JSON.parse(read.text), original, `${name}: Export gives back what Stock exported`);
		const record = importedSkinRecord(null, read.config, NOW);
		const stored = upsertBrandSkin(project(), record, true);
		assert.equal(stored.skin, "custom", `${name}: selected like a new Design skin`);
		assert.deepEqual(brandSkinsOf(stored).map((item) => item.id), ["custom"], `${name}: one selector entry`);
		const theme = themeOfProjectSkin(stored, stored.skin);
		assert.ok(theme);
		assert.equal(configText(theme), read.text, `${name}: the stored skin exports the same text`);
		const again = importStockExport(configText(theme));
		assert.ok(again.ok && again.text === read.text, `${name}: and imports again`);
		// both modes render for any of them, from the same sheets the preview and the ZIP use
		const sheets = skinSheets(skinSource("custom", theme), "document");
		assert.match(sheets.modes, /color-scheme: light/);
		assert.match(sheets.modes, /color-scheme: dark/);
	}
});

test("the older shapes of Stock's reader import too: stored { v: 1, theme }, a bare theme, a style preset", () => {
	const stored = importStockExport(REAL.stored);
	assert.ok(stored.ok);
	assert.equal(stored.config.palette?.h, 24);
	assert.equal(stored.config.skin, "cosmic-night");
	assert.equal(stored.config.tokens["shadow-card"], "sm");
	const bare = importStockExport(JSON.stringify(REAL.stored.theme));
	assert.ok(bare.ok && bare.text === stored.text);
	const preset = importStockExport(JSON.stringify(REAL.preset));
	assert.ok(preset.ok);
	assert.deepEqual([preset.config.skin, preset.config.font, preset.config.radius, preset.config.tokens], ["bubblegum", "open-sans", 0, { "shadow-card": "sm" }]);
	// the result is a v2 file the strict reader takes as well
	assert.ok(importThemeConfig(preset.text).ok);
	// a value the reader would drop is named, not lost; other formats are refused
	const dropped = importStockExport({ skin: "no-such-skin", radius: 4 });
	assert.ok(!dropped.ok && dropped.issues[0]?.code === "not_kept");
	assert.ok(!importStockExport({ format: "other" }).ok);
	assert.ok(!importStockExport("{nope").ok);
});

test("an imported skin and a Design skin are one record in one selector; a second import is the next revision", () => {
	const read = importStockExport(JSON.stringify(REAL.exports.palette));
	assert.ok(read.ok);
	const imported = importedSkinRecord(null, read.config, NOW);
	const design: BrandSkinRecord = { id: "brand-titan", name: "TITAN", createdAt: NOW, source: "design", brief: { name: "TITAN", thesis: { summary: "s", positioning: "p", antiPersonality: [] }, grammar: {} }, theme: read.config };
	const both = upsertBrandSkin(upsertBrandSkin(project(), imported, false), design, true);
	assert.deepEqual(brandSkinsOf(both).map((item) => item.id).sort(), ["brand-titan", "custom"]);
	for (const record of brandSkinsOf(both)) assert.deepEqual(Object.keys(record).filter((key) => !["id", "name", "createdAt", "source", "brief", "theme", "contract", "revision", "updatedAt"].includes(key)), [], "same fields");
	assert.equal(importedSkinRecord(imported, read.config, "2026-11-29T00:00:00.000Z"), imported, "the same config again: no change, no new revision");
	const other = importStockExport(JSON.stringify(REAL.exports.skinOnly));
	assert.ok(other.ok);
	const next = importedSkinRecord(imported, other.config, "2026-11-29T00:00:00.000Z");
	assert.deepEqual([next.id, next.createdAt, next.revision], ["custom", NOW, 2]);
	// Design edits an imported skin the way it edits its own
	assert.equal(editedBrandSkin(next, { brief: next.brief, theme: next.theme, contract: {} }).revision, 3);
	// the two ways in share the one writer
	assert.match(web("lib/theme/brand-skins.svelte.ts"), /saveBrandSkin\(importedSkinRecord\(/);
	assert.match(web("modules/chat/design/design.svelte.ts"), /saveBrandSkin\(/);
	assert.match(web("lib/theme/brand-skins.svelte.ts"), /importStockExport\(input\)/);
});

test("import, switch, export: the ZIP's theme.json of each chosen skin is what Stock's Import takes back", () => {
	const read = importStockExport(JSON.stringify(REAL.exports.skinOnly));
	assert.ok(read.ok);
	const designTheme = importStockExport(JSON.stringify(REAL.exports.palette));
	assert.ok(designTheme.ok);
	const design: BrandSkinRecord = { id: "brand-titan", name: "TITAN", createdAt: NOW, source: "design", brief: { name: "TITAN", thesis: { summary: "s", positioning: "p", antiPersonality: [] }, grammar: {} }, theme: designTheme.config };
	let current = upsertBrandSkin(upsertBrandSkin(project(), importedSkinRecord(null, read.config, NOW), false), design, true);
	const page = studioPage({ title: "Coffee", now: NOW });
	for (const [skin, expected] of [["brand-titan", designTheme.text], ["custom", read.text], ["brand-titan", designTheme.text]] as const) {
		current = { ...current, skin };
		const options = packSkinOptionsFor(skin, current);
		const files = packFilesFromPage(page, options);
		const theme = files.find((file) => file.path.endsWith("theme.json"));
		assert.equal(theme?.content.trim(), expected.trim(), `${skin}: theme.json is the skin's export`);
		const back = importStockExport(theme?.content ?? "");
		assert.ok(back.ok && back.text === expected, `${skin}: and imports again unchanged`);
		assert.ok(files.find((file) => file.path.endsWith("custom-skin.css"))?.content.includes(skinSheets(skinSource(skin, brandSkinOf(current, skin)?.theme ?? null), "document").modes));
	}
});

// ---- a deterministic apply ---------------------------------------------------------------------------------------------

type Node = { localName: string; id: string; textContent: string; attrs: Map<string, string>; rel?: string; href?: string; setAttribute(name: string, value: string): void; remove(): void };

function fakeDocument() {
	const children: Node[] = [];
	const rootAttrs = new Map<string, string>();
	const rootProps = new Map<string, string>();
	const make = (localName: string): Node => {
		const node: Node = {
			localName,
			id: "",
			textContent: "",
			attrs: new Map(),
			setAttribute(name, value) {
				node.attrs.set(name, value);
			},
			remove() {
				const at = children.indexOf(node);
				if (at >= 0) children.splice(at, 1);
			}
		};
		return node;
	};
	const doc = {
		head: {
			appendChild(node: Node) {
				node.remove();
				children.push(node);
			},
			insertBefore(node: Node, ref: Node) {
				node.remove();
				children.splice(children.indexOf(ref), 0, node);
			},
			querySelectorAll(selector: string) {
				const attr = selector.match(/\[([^\]]+)\]/)?.[1] ?? "";
				return children.filter((node) => node.attrs.has(attr));
			}
		},
		documentElement: {
			setAttribute: (name: string, value: string) => void rootAttrs.set(name, value),
			removeAttribute: (name: string) => void rootAttrs.delete(name),
			style: { setProperty: (prop: string, value: string) => void rootProps.set(prop, value), removeProperty: (prop: string) => void rootProps.delete(prop) }
		},
		getElementById: (id: string) => children.find((node) => node.id === id) ?? null,
		createElement: make
	};
	return { doc: Object.assign(Object.create(null), doc) as unknown as Document, children, rootAttrs, rootProps };
}

function brand(h: number, skin = "modern-minimal"): SkinSource {
	const read = importThemeConfig(readFileSync(new URL("./fixtures/stock-theme-export.json", import.meta.url), "utf8"));
	assert.ok(read.ok);
	return skinSource(`brand-${h}`, { ...read.config, skin, palette: { harmony: "complementary", h, s: 85, l: 52, contrast: "AAA" } });
}

/** A loader whose answers arrive when the test says so, in any order. */
function loader() {
	const waiting = new Map<string, Array<() => void>>();
	const calls: string[] = [];
	return {
		calls,
		baseCss: (source: SkinSource) =>
			new Promise<string>((resolve) => {
				calls.push(source.registry ?? "");
				const list = waiting.get(source.registry ?? "") ?? [];
				list.push(() => resolve(`/* base ${source.registry} */`));
				waiting.set(source.registry ?? "", list);
			}),
		release: (registry: string) => void waiting.get(registry)?.splice(0).forEach((fn) => fn())
	};
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("rapid switching, slow load finishing last: the last skin applied is what the document wears", async () => {
	const { doc, children, rootAttrs } = fakeDocument();
	const io = loader();
	const applier = createSkinApplier(doc, { target: "document", baseCss: io.baseCss });
	const slow = brand(210, "claude");
	const fast = brand(25, "sky");
	const results = [applier.apply(slow), applier.apply(fast)];
	io.release("sky");
	await settle();
	assert.equal(applier.worn, fast.key, "the fast one is on");
	io.release("claude"); // the slow load of the superseded skin arrives after
	assert.deepEqual(await Promise.all(results), [false, true], "the superseded call reports it");
	assert.equal(applier.worn, fast.key, "and does not paint over the later one");
	assert.match(children.find((node) => node.id === "buildy-skin")?.textContent ?? "", /base sky/);
	assert.match(children.find((node) => node.id === "buildy-skin-modes")?.textContent ?? "", /--primary: hsl\(25 /);
	assert.equal(rootAttrs.get("data-skin"), "sky");
});

test("any arrival order of a burst of switches ends on the last one, with its own palette, in both modes", async () => {
	const skins = [brand(210, "claude"), brand(25, "sky"), brand(140, "claude"), brand(300, "notebook"), brand(60, "sky")];
	const orders = [["claude", "sky", "notebook"], ["notebook", "sky", "claude"], ["sky", "notebook", "claude"], ["sky", "claude", "notebook"]];
	for (const order of orders) {
		const { doc, children } = fakeDocument();
		const io = loader();
		const applier = createSkinApplier(doc, { target: "scope", baseCss: io.baseCss });
		const all = skins.map((skin) => applier.apply(skin));
		for (const registry of order) {
			io.release(registry);
			await settle();
		}
		const last = skins[skins.length - 1]!;
		await Promise.all(all);
		assert.equal(applier.worn, last.key, `order ${order.join(">")}`);
		const modes = children.find((node) => node.id === "buildy-page-skin-modes")?.textContent ?? "";
		assert.equal(modes, skinSheets(last, "scope").modes, "the palette sheet of the last skin, light and dark");
		assert.match(modes, /color-scheme: light/);
		assert.match(modes, /color-scheme: dark/);
		assert.equal(children.find((node) => node.id === "buildy-page-skin-scope")?.textContent, `/* base ${last.registry} */`);
	}
});

test("the style elements keep one fixed order (base, then palette) through every switch", async () => {
	const { doc, children } = fakeDocument();
	const io = loader();
	const applier = createSkinApplier(doc, { target: "document", baseCss: io.baseCss });
	const order = () => children.filter((node) => node.localName === "style").map((node) => node.id).join(",");
	for (const skin of [brand(210, "claude"), skinSource(null, null), brand(25, "claude"), skinSource("sky", null)]) {
		const pending = applier.apply(skin);
		io.release(skin.registry ?? "");
		await pending;
		assert.equal(order(), "buildy-skin,buildy-skin-modes", skin.key.slice(0, 20));
	}
});

test("a switch to the default clears the palette and the root attributes; a cached base commits at once", async () => {
	const { doc, children, rootAttrs, rootProps } = fakeDocument();
	const io = loader();
	const applier = createSkinApplier(doc, { target: "document", baseCss: io.baseCss });
	const first = brand(210, "claude");
	const done = applier.apply(first);
	io.release("claude");
	await done;
	assert.ok(rootAttrs.size > 0 && rootProps.size > 0);
	const none = skinSource(null, null);
	const clear = applier.apply(none);
	io.release("");
	await clear;
	assert.equal(rootAttrs.size, 0, "no leftover attribute");
	assert.equal(rootProps.size, 0, "no leftover inline variable");
	assert.equal(children.find((node) => node.id === "buildy-skin-modes")?.textContent, "");
	// the first skin's base is cached: applying it again does not load, and the palette is on before the promise settles
	const calls = io.calls.length;
	const back = applier.apply(first);
	assert.equal(applier.worn, first.key, "committed synchronously");
	await back;
	assert.equal(io.calls.length, calls, "no second load");
});

test("a fresh document (an iframe that loaded) gets the skin in force on its first apply", async () => {
	const io = loader();
	const source = brand(25, "sky");
	for (let i = 0; i < 2; i++) {
		const { doc, children } = fakeDocument();
		const applier = createSkinApplier(doc, { target: "document", baseCss: io.baseCss });
		const done = applier.apply(source);
		io.release("sky");
		await done;
		assert.equal(children.filter((node) => node.localName === "style").length, 2, `document ${i}`);
		assert.equal(applier.worn, source.key);
	}
	assert.match(web("app/PreviewPane.svelte"), /if \(doc\) void applySkin\(doc, id, config\)/, "applied when the frame document exists");
	assert.match(web("app/StandalonePreview.svelte"), /applySkin\(document,/, "and in the preview window");
});

/**
 * Registry and catalog sources (ADR 0012, 0034): the pinned props schemas and variants, the registry snapshot (the CLI
 * tree and its ui8kit.lock.json), the props gate (Ajv, fail-closed), the CSS from the registry tree, `lib` without .svelte,
 * the Stock thumbnails and asset pages, and the pinned Stock snapshot.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../../packages/builder-core/src/index.ts";
import { installPropsGate, validateRegistryProps } from "../../packages/builder-core/src/catalog/props-gate.ts";

const {
	blockAssetUrl, blockThumbUrl, catalogSnapshot, catalogSourceFor, catalogSources, lucideIcons, propsDigest, propsEventsFor, propsSchemaFor,
	organismFor, parseCatalogSnapshot, registryItemFor, screenThumbUrl, setPropsValidator, stockThumbUrl, stockVariantOf, variantProps
} = core as Record<string, any>;

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const FEATURES = catalogSourceFor("block.features")!;
const SNAPSHOT_PATH = new URL("../../packages/builder-core/src/catalog/snapshot.json", import.meta.url);
const fileUnknown: unknown = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
const raw = parseCatalogSnapshot(fileUnknown);

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

test("props pin: file sha256 and the internal digest (compact JSON without digest) match registry/snapshot.json", () => {
	const snapshot = JSON.parse(read("registry/snapshot.json")) as { props: { url: string; sha256: string; digest: string; items: number } };
	const text = read("registry/props.v0.json");
	assert.equal(snapshot.props.url, "https://registry.buildy.tw/props/v0.json");
	assert.equal(createHash("sha256").update(text).digest("hex"), snapshot.props.sha256);
	const { digest, ...rest } = JSON.parse(text) as { digest: string; items: Record<string, unknown> };
	assert.equal(`sha256:${createHash("sha256").update(JSON.stringify(rest)).digest("hex")}`, digest);
	assert.equal(digest, snapshot.props.digest);
	assert.equal(propsDigest, digest);
	assert.equal(Object.keys(rest.items).length, snapshot.props.items);
	assert.deepEqual(catalogSources.props, { url: snapshot.props.url, sha256: snapshot.props.sha256, digest });
});

test("compact props.json rebuilds every published item schema exactly; every variants item has one", () => {
	const published = JSON.parse(read("registry/props.v0.json")) as { items: Record<string, { schema: unknown; events: string[]; slots: string[] }> };
	for (const [item, entry] of Object.entries(published.items)) {
		assert.equal(JSON.stringify(propsSchemaFor(item)), JSON.stringify(entry.schema), item);
		assert.deepEqual(propsEventsFor(item), { events: entry.events, slots: entry.slots }, item);
	}
	for (const item of Object.keys(catalogSources.blocks)) assert.ok(propsSchemaFor(item), `${item} has no props schema`);
});

test("every catalog variant renders props the published schema accepts (variant presets are partial; the merge is validated)", () => {
	const rows = [1, 2, 3].map((i) => ({ id: `row-${i}`, kind: "feature", title: `Row ${i}`, summary: "Row text", copy: { icon: lucideIcons()[i]!, href: "#row" } }));
	let checked = 0;
	for (const [asset, hit] of Object.entries(catalogSources.assets)) {
		const catalogBlock = asset.slice(0, asset.indexOf("/"));
		for (const children of [[], rows]) {
			const block = { id: "block-1", kind: "hero", title: "Title", summary: "Lede", catalogBlock, variant: hit.variant, copy: { action: "Go", href: "#go", eyebrow: "Eyebrow", badge: "New", brand: "Brand" }, children };
			const render = organismFor(block as never)!;
			assert.ok(render, asset);
			assert.deepEqual(validateRegistryProps(render), [], `${asset}: ${JSON.stringify(validateRegistryProps(render))}`);
			checked += 1;
		}
	}
	assert.ok(checked >= 1000, `${checked}`);
});

test("schema gate fails: an enum axis, an unknown prop and a wrong type are reported with pointer and allowed values", () => {
	const block = { id: "block-f", kind: "features", title: "Features", summary: "Lede", catalogBlock: "block.features", variant: "grid" };
	const render = organismFor(block as never)!;
	assert.deepEqual(validateRegistryProps(render), []);
	const axis = validateRegistryProps({ ...render, props: { ...render.props, layout: "mosaic" } });
	assert.equal(axis[0]?.pointer, "/layout");
	assert.equal(axis[0]?.keyword, "enum");
	assert.equal(axis[0]?.value, "mosaic");
	assert.ok((axis[0]?.allowed ?? []).length >= 2);
	const extra = validateRegistryProps({ ...render, props: { ...render.props, onadd: "x" } });
	assert.equal(extra[0]?.keyword, "additionalProperties");
	const type = validateRegistryProps({ ...render, props: { ...render.props, title: 42 } });
	assert.equal(type[0]?.pointer, "/title");
	// Reference-shape branches ({"$": ...}, {op, args}) of an anyOf are noise, never reported.
	assert.ok(type.every((issue) => issue.message !== "must have required property '$'"));
});

test("the gate is fail-closed: without a validator a page with a registry block is rejected", () => {
	const page = { version: 2, title: "Site", slug: "site", locale: "en", blocks: [{ id: "block-hero", item: "hero-classic", variant: "centered" }] } as never;
	setPropsValidator(null);
	try {
		const r = core.checkPageDoc(page);
		assert.equal(r.ok, false);
		assert.equal((r as { issues: Array<{ code: string }> }).issues[0]!.code, "props_gate_unavailable");
	} finally {
		installPropsGate();
	}
	assert.equal(core.checkPageDoc(page).ok, true);
});

test("events and slots stay next to the schema: never data props, wired by the host", () => {
	assert.deepEqual(propsEventsFor("dish-card"), { events: ["add"], slots: [] });
	assert.deepEqual(propsEventsFor("pricing-card"), { events: ["select"], slots: ["footer"] });
	const schema = propsSchemaFor("dish-card") as { properties: Record<string, unknown> };
	assert.equal("onadd" in schema.properties, false);
	const render = organismFor({ id: "block-dish", kind: "dish", title: "Soup", summary: "Hot", catalogBlock: "block.dish", variant: "vertical" } as never);
	if (render) {
		assert.deepEqual(render.events, ["add"]);
		assert.equal("onadd" in render.props, false);
		assert.deepEqual(validateRegistryProps(render), []);
	}
});

test("registry snapshot: the CLI tree matches its ui8kit.lock.json (offline), every item from registry.buildy.tw/svelte", () => {
	const run = spawnSync(process.execPath, ["scripts/registry-snapshot.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
	assert.equal(run.status, 0, run.stderr || run.stdout);
	assert.match(run.stdout, /all sha256 match/);
	const lock = JSON.parse(readFileSync(join(ROOT, "registry/svelte/ui8kit.lock.json"), "utf8")) as {
		lockVersion: number;
		cli: string;
		items: Record<string, { name: string; source: string; runtime: string; files: Record<string, string> }>;
	};
	assert.equal(lock.lockVersion, 2);
	assert.equal(`ui8kit@${lock.cli}`, catalogSources.cli);
	const items = Object.values(lock.items);
	assert.ok(items.length >= 300);
	for (const item of items) {
		assert.equal(item.source, "https://registry.buildy.tw/svelte");
		assert.equal(item.runtime, "svelte");
		for (const sha of Object.values(item.files)) assert.match(sha, /^[0-9a-f]{64}$/);
	}
	const config = JSON.parse(readFileSync(join(ROOT, "registry/svelte/ui8kit.config.json"), "utf8"));
	assert.equal(config.dir, "src");
	assert.equal(config.framework, "svelte");
	assert.deepEqual(catalogSources.initItems, ["presets", "recipes", "utils"]);
});

test("published variants: sha256 pinned, every Stock catalog asset maps to a registry block of the snapshot", () => {
	const text = readFileSync(join(ROOT, "registry/variants.v0.json"));
	assert.equal(createHash("sha256").update(text).digest("hex"), catalogSources.variants.sha256);
	const variants = JSON.parse(text.toString("utf8")) as { items: Record<string, { variants: Record<string, { asset: string }> }> };
	const assets = Object.values(variants.items).flatMap((item) => Object.values(item.variants).map((variant) => variant.asset));
	assert.equal(assets.length, 532);
	const catalogIds = catalogSnapshot.blockIndex.flatMap((entry) => entry.catalogIds);
	assert.equal(catalogIds.length, 532, "no cap on variants per catalog block");
	for (const id of catalogIds) {
		const [spec, variant] = [id.slice(0, id.indexOf("/")), id.slice(id.indexOf("/") + 1)];
		const hit = registryItemFor(spec, variant);
		assert.ok(hit, `${id} has no registry item`);
		assert.equal(catalogSources.items[hit.item]?.type, "registry:block", id);
	}
	for (const entry of catalogSnapshot.blockIndex) assert.ok(registryItemFor(entry.spec), `${entry.spec} has no default item`);
	assert.equal(FEATURES.item, "feature-grid");
	assert.equal(FEATURES.defaultVariant, "grid");
	assert.ok(Object.keys(FEATURES.variants).length >= 2);
	assert.ok(lucideIcons().length > 100);
});

test("CSS: theme and tokens only from the registry tree; the chat declares no colour tokens of its own", () => {
	const app = readFileSync(join(ROOT, "apps/chat-web/src/app.css"), "utf8");
	assert.match(app, /@import "\.\.\/\.\.\/\.\.\/registry\/svelte\/src\/styles\/theme\.css"/);
	assert.match(app, /@import "\.\.\/\.\.\/\.\.\/registry\/svelte\/src\/styles\/kit\.css"/);
	const frame = readFileSync(join(ROOT, "apps/chat-web/src/preview-frame.css"), "utf8");
	assert.match(frame, /@import "\.\.\/\.\.\/\.\.\/registry\/svelte\/src\/styles\/index\.css"/);
	const theme = readFileSync(join(ROOT, "registry/svelte/src/styles/theme.css"), "utf8");
	assert.match(theme, /@custom-variant dark \(&:is\(\.dark \*, \[data-theme="dark"\] \*\)\)/);
	// ADR 0026: the chat UI skin is the one place that maps the shell's own tones and radius onto the kit names
	// (styles/chat-skin.css, plus the app @theme radius in app.css); the preview frame never loads either.
	const SKIN = join(ROOT, "apps/chat-web/src/styles/chat-skin.css");
	for (const file of walk(join(ROOT, "apps/chat-web/src")).filter((path) => path.endsWith(".css") && path !== SKIN)) {
		const css = readFileSync(file, "utf8");
		const checked = file.replace(/\\/g, "/").endsWith("/app.css") ? css.replace(/@theme(?: inline)? \{[^}]*\}/g, (block) => block.replace(/--radius[a-z0-9-]*:[^;]*;/g, "")) : css;
		assert.doesNotMatch(checked, /--(background|foreground|primary|border|radius)\s*:/, `${file} redeclares a registry token`);
	}
	assert.doesNotMatch(frame, /chat-skin|app\.css/, "the preview frame never loads the chat UI skin");
});

test("layout: lib holds only logic (no .svelte), no chat-owned 'compose' path, no own primitives", () => {
	const src = join(ROOT, "apps/chat-web/src");
	const files = walk(src).map((path) => path.slice(src.length + 1).split("\\").join("/"));
	// Vendored Tabler glyphs for the shell. Not compositions: each file is one SVG, and page blocks stay on Lucide.
	const shellIcon = (path: string) => path.startsWith("lib/shell-icons/") && path.endsWith(".svelte");
	assert.deepEqual(files.filter((path) => path.startsWith("lib/") && path.endsWith(".svelte") && !shellIcon(path)), []);
	assert.ok(files.some(shellIcon));
	assert.deepEqual(files.filter((path) => /(^|\/)compose(\/|\.|$)/i.test(path)), []);
	assert.deepEqual(files.filter((path) => path.startsWith("ui/") || path.startsWith("utils/") || path.startsWith("registry/")), []);
	for (const file of files.filter((path) => path.endsWith(".svelte"))) {
		const text = readFileSync(join(src, file), "utf8");
		for (const [, spec] of text.matchAll(/from "([^"]+\.svelte)"/g)) {
			// $lib/x.svelte names a runes module (x.svelte.ts): lib holds no components (asserted above).
			assert.ok(["$registry/", "$lib/", "$modules/", "./", "../app/", "../../app/", "../../../app/", "../ui/", "../modules/"].some((prefix) => spec!.startsWith(prefix)), `${file} imports ${spec}`);
		}
	}
});

test("Stock thumbnails and asset pages: exact variant pages, versioned WebP thumbnails, null when Stock has none", () => {
	assert.equal(blockAssetUrl("block.features", "grid2"), "https://app.codegen-x.com/#/asset/block.features/grid2");
	assert.match(String(blockThumbUrl("block.features", "grid2")), /^https:\/\/app\.codegen-x\.com\/thumbs\/block\.features--grid2\.webp\?v=[0-9a-f]{8}$/);
	// an unknown variant falls back to the default variant's page and picture, an unknown block has neither
	assert.equal(blockAssetUrl("block.features", "nosuch"), blockAssetUrl("block.features", stockVariantOf("block.features")));
	assert.equal(blockAssetUrl("block.nosuch", "x"), null);
	assert.equal(blockThumbUrl("block.nosuch", "x"), null);
	assert.match(String(screenThumbUrl("screen.site/home")), /^https:\/\/app\.codegen-x\.com\/thumbs\/screen\.site--home\.webp\?v=[0-9a-f]{8}$/);
	assert.equal(screenThumbUrl("screen.nosuch/home"), null);
	// only snapshot-shaped paths become URLs
	assert.equal(stockThumbUrl("https://evil.test/x.webp"), null);
	assert.equal(stockThumbUrl("thumbs/../x.webp"), null);
	// coverage: every screen and nearly every block variant has a picture
	const variants = catalogSnapshot.blockIndex.flatMap((b) => b.variants.map((v) => blockThumbUrl(b.spec, v) !== null && b.thumbs?.[v] !== undefined));
	assert.ok(variants.filter(Boolean).length >= 520, `${variants.filter(Boolean).length} of ${variants.length} variants`);
	assert.equal(catalogSnapshot.screens.filter((s) => s.thumb).length, catalogSnapshot.screens.length);
});

test("production snapshot is pinned codegen-x Stock, not a synthetic TEST fixture", () => {
	assert.equal(raw.provider, "codegen-x");
	assert.equal(raw.repo, "codegen-x/ui8kit");
	assert.equal(raw.sourceArtifact, "apps/stock/content/assets.v0.json");
	// the digest is the pin of the graph (catalog/stock-registry.v0.json), not a literal that goes stale at every re-pin
	assert.equal(raw.sourceDigest, (JSON.parse(read("catalog/stock-registry.v0.json")) as { sources: { codegenX: { assetsDigest: string } } }).sources.codegenX.assetsDigest);
	assert.equal(raw.counts.screen, 80);
	assert.equal(raw.screens.length, 80);
	assert.equal(catalogSnapshot.screens.length, 80);
	assert.equal(JSON.stringify(raw).includes("search_blocks"), false);
	assert.equal(
		raw.screens.some((screen) => /synthetic|TEST block/i.test(`${screen.screenId} ${screen.title}`)),
		false
	);
});

test("snapshot parse narrows ownerFilters and rejects a widened type", () => {
	assert.equal(catalogSnapshot.ownerFilters.blank.type, "screen");
	assert.equal(catalogSnapshot.ownerFilters.dashboard.type, "screen");
	assert.equal(catalogSnapshot.ownerFilters.landing.type, "screen");
	assert.equal(catalogSnapshot.ownerFilters.website.type, "screen");
	const clone = JSON.parse(JSON.stringify(fileUnknown)) as {
		ownerFilters: Record<string, { type?: string; section?: string; job?: string }>;
	};
	clone.ownerFilters.dashboard = { type: "hero", section: "dashboard" };
	assert.throws(
		() => parseCatalogSnapshot(clone),
		(err: Error & { code?: string }) => err.code === "catalog_snapshot_invalid" && /ownerFilters\.dashboard\.type/.test(err.message)
	);
});

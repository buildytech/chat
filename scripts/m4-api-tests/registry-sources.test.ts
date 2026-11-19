/**
 * Registry sources (ADR 0012, 0034, 0059): the pinned props schemas and variants (narrowed to the catalog blocks), the
 * registry snapshot (the CLI tree and its ui8kit.lock.json), the props gate (Ajv, fail-closed), the CSS from the registry
 * tree, and `lib` without .svelte.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { catalogSearch, catalogSources, checkPageDoc, propsDigest, propsEventsFor, propsSchemaFor, sampleProps, setPropsValidator } from "../../packages/builder-core/src/index.ts";
import { installPropsGate, validateRegistryProps } from "../../packages/builder-core/src/catalog/props-gate.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

test("props pin: file sha256 and digest match registry/snapshot.json; one schema per catalog block", () => {
	const snapshot = JSON.parse(read("registry/snapshot.json")) as { props: { url: string; sha256: string; digest: string }; files: Record<string, string> };
	const text = read("registry/props.v0.json");
	assert.equal(snapshot.props.url, "https://registry.buildy.tw/props/v0.json");
	assert.match(snapshot.props.sha256, /^[0-9a-f]{64}$/, "the upstream file's sha256");
	assert.equal(createHash("sha256").update(text).digest("hex"), snapshot.files["registry/props.v0.json"], "the narrowed file is pinned");
	const published = JSON.parse(text) as { digest: string; items: Record<string, { schema: unknown; events: string[]; slots: string[] }> };
	assert.equal(published.digest, snapshot.props.digest);
	assert.equal(propsDigest, published.digest);
	assert.deepEqual(catalogSources.props, snapshot.props);
	for (const [item, entry] of Object.entries(published.items)) {
		assert.equal(JSON.stringify(propsSchemaFor(item)), JSON.stringify(entry.schema), item);
		assert.deepEqual(propsEventsFor(item), { events: entry.events, slots: entry.slots }, item);
	}
	for (const item of ["hero-simple", "team-simple"]) assert.ok(propsSchemaFor(item), `${item} has no props schema`);
});

test("every feed card has sample props the published schema accepts", () => {
	for (const card of catalogSearch().items) {
		const props = sampleProps(card.item, card.variant, "block-1");
		assert.deepEqual(validateRegistryProps({ item: card.item, props }), [], card.id);
	}
});

test("schema gate fails: an enum axis, an unknown prop and a wrong type are reported with pointer and allowed values", () => {
	const render = { item: "hero-simple", props: sampleProps("hero-simple", "mediaEnd", "block-h") as Record<string, unknown> };
	assert.deepEqual(validateRegistryProps(render), []);
	const axis = validateRegistryProps({ ...render, props: { ...render.props, media: "mosaic" } });
	assert.equal(axis[0]?.pointer, "/media");
	assert.equal(axis[0]?.keyword, "enum");
	assert.equal(axis[0]?.value, "mosaic");
	assert.ok((axis[0]?.allowed ?? []).length >= 2);
	const extra = validateRegistryProps({ ...render, props: { ...render.props, onadd: "x" } });
	assert.equal(extra[0]?.keyword, "additionalProperties");
	const type = validateRegistryProps({ ...render, props: { ...render.props, title: 42 } });
	assert.equal(type[0]?.pointer, "/title");
	assert.ok(type.every((issue) => issue.message !== "must have required property '$'"));
});

test("the gate is fail-closed: without a validator a page with a registry block is rejected", () => {
	const page = { version: 2, title: "Site", slug: "site", locale: "en", blocks: [{ id: "block-hero", item: "hero-simple", variant: "mediaEnd" }] } as never;
	setPropsValidator(null);
	try {
		const r = checkPageDoc(page);
		assert.equal(r.ok, false);
		assert.equal((r as { issues: Array<{ code: string }> }).issues[0]!.code, "props_gate_unavailable");
	} finally {
		installPropsGate();
	}
	assert.equal(checkPageDoc(page).ok, true);
});

test("registry snapshot: the CLI tree matches its ui8kit.lock.json and every pinned file (offline), every item from registry.buildy.tw/svelte", () => {
	const run = spawnSync(process.execPath, ["scripts/registry-snapshot.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
	assert.equal(run.status, 0, run.stderr || run.stdout);
	assert.match(run.stdout, /all match/);
	const lock = JSON.parse(read("registry/svelte/ui8kit.lock.json")) as { lockVersion: number; cli: string; items: Record<string, { source: string; runtime: string; files: Record<string, string> }> };
	assert.equal(lock.lockVersion, 2);
	assert.equal(`ui8kit@${lock.cli}`, catalogSources.cli);
	for (const item of Object.values(lock.items)) {
		assert.equal(item.source, "https://registry.buildy.tw/svelte");
		assert.equal(item.runtime, "svelte");
		for (const sha of Object.values(item.files)) assert.match(sha, /^[0-9a-f]{64}$/);
	}
	assert.ok(lock.items["registry.buildy.tw|svelte|hero-simple"] && lock.items["registry.buildy.tw|svelte|team-simple"]);
	const config = JSON.parse(read("registry/svelte/ui8kit.config.json"));
	assert.equal(config.dir, "src");
	assert.equal(config.framework, "svelte");
	assert.deepEqual(catalogSources.initItems, ["presets", "recipes", "utils"]);
});

test("published variants: sha256 pinned, every feed card is a variant of its registry block", () => {
	const text = readFileSync(join(ROOT, "registry/variants.v0.json"));
	const files = (JSON.parse(read("registry/snapshot.json")) as { files: Record<string, string> }).files;
	assert.equal(createHash("sha256").update(text).digest("hex"), files["registry/variants.v0.json"]);
	const variants = JSON.parse(text.toString("utf8")) as { items: Record<string, { variants: Record<string, unknown> }> };
	for (const card of catalogSearch().items) assert.ok(variants.items[card.item]?.variants[card.variant], card.id);
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
	// The chat module's part of the skin (composer radii and shadows, ADR 0041) lives with the module so it is not in a chat-off bundle.
	const MODULE_SKIN = join(ROOT, "apps/chat-web/src/modules/chat/chat.css");
	for (const file of walk(join(ROOT, "apps/chat-web/src")).filter((path) => path.endsWith(".css") && path !== SKIN && path !== MODULE_SKIN)) {
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
			assert.ok(["$registry/", "$lib/", "$modules/", "./", "../app/", "../../app/", "../../../app/", "../ui/"].some((prefix) => spec!.startsWith(prefix)), `${file} imports ${spec}`);
		}
	}
});


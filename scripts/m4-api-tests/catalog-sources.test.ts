/**
 * Registry sources of catalog blocks: the pinned registry snapshot (the CLI tree and its ui8kit.lock.json), the
 * published variants (registry.buildy.tw/variants/v0.json, sha256-pinned), variant and icon validation in
 * propose_layout / edit_page / get_block_details, the page block -> registry block props mapping, and the CSS.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { pageSpecIssues, type Page } from "../../packages/page-contract/src/index.ts";
import {
	catalogSnapshot,
	catalogSourceFor,
	catalogSources,
	editPage,
	editPageParameterSchema,
	executeTool,
	lucideIcons,
	organismFor,
	proposeContentParameterSchema,
	proposeLayout,
	registryItemFor,
	variantProps,
	type LayoutProposal
} from "../../packages/builder-core/src/index.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const NOW = "2026-11-09T12:00:00.000Z";
const FEATURES = catalogSourceFor("block.features")!;

function propose(block: Record<string, unknown>) {
	return executeTool(
		{
			name: "propose_layout",
			arguments: { brief: "Landing for a static site builder", screenId: "screen.site/home", locale: "en", blocks: [{ kind: "features", title: "Features", ...block }] }
		},
		{ liveTurn: true, authorBrief: "Landing with features" }
	);
}

function features(page: Page) {
	return page.layout.blocks.find((block) => block.kind === "features")!;
}

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

test("propose_layout records catalogBlock and variant, keeps row icons and the section link", () => {
	const r = propose({ variant: "tiles4", action: { label: "View all", href: "#/features" }, items: [{ label: "Fast", detail: "Static pages.", icon: "zap" }] });
	assert.equal(r.ok, true, JSON.stringify(r));
	const proposal = r.result as LayoutProposal;
	const block = features(proposal.page);
	assert.equal(block.catalogBlock, "block.features");
	assert.equal(block.variant, "tiles4");
	assert.equal(block.copy?.action, "View all");
	assert.equal(block.copy?.href, "#/features");
	assert.equal(block.children?.[0]?.copy?.icon, "zap");
	assert.deepEqual(pageSpecIssues(proposal.page), []);
	const ref = proposal.catalogRefs.blocks.find((entry) => entry.kind === "features") as { variant?: string; registryItem?: string };
	assert.equal(ref.variant, "tiles4");
	assert.equal(ref.registryItem, "feature-grid");
});

test("without a variant the block records the spec default variant", () => {
	const r = propose({ items: [{ label: "Fast", detail: "Static pages." }] });
	assert.equal(r.ok, true, JSON.stringify(r));
	assert.equal(features((r.result as LayoutProposal).page).variant, FEATURES.defaultVariant);
});

test("unknown variant and non-Lucide icon are rejected with a code and path", () => {
	const variant = propose({ variant: "mosaic" });
	assert.equal(variant.ok, false);
	assert.equal((variant as { code: string }).code, "unknown_variant");
	const icon = propose({ items: [{ label: "Fast", icon: "rocketship" }] });
	assert.equal(icon.ok, false);
	// The published props schema rejects it (the lucideIcon enum), not a list of the chat's own.
	assert.equal((icon as { code: string }).code, "props_invalid");
	assert.match((icon as { path: string }).path, /children\[0\]\.copy\.icon$/);
	// The allowed names travel with the error, so the model can retry without another tool call.
	assert.match((icon as { message: string }).message, /"rocketship".*Allowed: .*\bzap\b/);
});

test("get_block_details keeps the requested variant and returns the registry presets", () => {
	const r = executeTool({ name: "get_block_details", arguments: { id: "features", variant: "grid2" } });
	assert.equal(r.ok, true, JSON.stringify(r));
	const details = r.result as { variant?: string; registry?: { item: string; variantProps: Record<string, unknown>; icons: string[] } };
	assert.equal(details.variant, "grid2");
	assert.equal(details.registry?.item, "feature-grid");
	assert.deepEqual(details.registry?.variantProps, variantProps("block.features", "grid2"));
	const bad = executeTool({ name: "get_block_details", arguments: { id: "features", variant: "mosaic" } });
	assert.equal(bad.ok, false);
});

function website() {
	const r = proposeLayout({ brief: "Website for a coffee house", scenarioId: "website", screenId: "screen.site/home", expectedRevision: 0, now: NOW, content: { locale: "en", blocks: [] } });
	assert.ok(r.ok);
	return { page: r.page, provenance: { screenId: r.provenance.screenId, scenarioId: "website" as const, missing: r.missing } };
}

test("edit_page set_variant changes only the variant; unknown variants are rejected; null restores the default", () => {
	const { page, provenance } = website();
	const block = features(page);
	const base = { page, provenance, expectedRevision: 1, now: NOW };
	const set = editPage({ ...base, patch: { ops: [{ op: "set_variant", blockId: block.id, variant: "rows" }] } });
	assert.ok(set.ok, JSON.stringify(set));
	const changed = features((set as LayoutProposal).page);
	assert.equal(changed.variant, "rows");
	assert.deepEqual({ ...changed, variant: block.variant }, block);
	const bad = editPage({ ...base, patch: { ops: [{ op: "set_variant", blockId: block.id, variant: "mosaic" }] } });
	assert.equal(bad.ok, false);
	assert.equal((bad as { code: string }).code, "unknown_variant");
	const reset = editPage({ ...base, page: (set as LayoutProposal).page, patch: { ops: [{ op: "set_variant", blockId: block.id, variant: null }] } });
	assert.ok(reset.ok, JSON.stringify(reset));
	assert.equal(features((reset as LayoutProposal).page).variant, FEATURES.defaultVariant);
});

test("edit_page set_items carries row icons and rejects unknown ones", () => {
	const { page, provenance } = website();
	const block = features(page);
	const base = { page, provenance, expectedRevision: 1, now: NOW };
	const ok = editPage({ ...base, patch: { ops: [{ op: "set_items", blockId: block.id, items: [{ label: "Fresh beans", detail: "Roasted weekly.", icon: "star" }] }] } });
	assert.ok(ok.ok, JSON.stringify(ok));
	assert.equal(features((ok as LayoutProposal).page).children?.[0]?.copy?.icon, "star");
	const bad = editPage({ ...base, patch: { ops: [{ op: "set_items", blockId: block.id, items: [{ label: "Fresh beans", icon: "rocketship" }] }] } });
	assert.equal(bad.ok, false);
});

test("registry block props: variant props, page content in the block's prop names, fallback icon for a row without one", () => {
	const r = propose({ variant: "cells4", action: { label: "View all", href: "#/features" }, items: [{ label: "Fast", detail: "Static pages.", icon: "zap" }, { label: "Plain", detail: "No icon." }] });
	assert.equal(r.ok, true, JSON.stringify(r));
	const block = features((r.result as LayoutProposal).page);
	const render = organismFor(block)!;
	assert.equal(render.organism, "blocks/feature-grid.svelte");
	assert.equal(render.variant, "cells4");
	for (const axis of ["layout", "cols", "item", "density"]) assert.equal(render.props[axis], (variantProps("block.features", "cells4") as Record<string, unknown>)[axis], axis);
	assert.equal(render.props.id, block.id);
	assert.equal(render.props.title, block.title);
	// The page's own link wins over the variant's sample href; the dictionary label ref is never passed on.
	assert.deepEqual(render.props.action, { label: "View all", href: "#/features" });
	const rows = render.props.features as Array<{ title: string; text: string; icon: string }>;
	assert.deepEqual(rows.map((row) => row.icon), ["zap", "circle-dot"]);
	assert.equal(rows[0]!.text, "Static pages.");
	assert.doesNotMatch(JSON.stringify(render.props), /"\$"/);
	assert.equal(organismFor({ ...block, catalogBlock: undefined }), null);
});

test("registry block props: edited copy (headline, lede, brand) wins over the block title and summary", () => {
	const hero = { id: "block-hero", kind: "hero", title: "Old", summary: "Old lede", catalogBlock: "block.hero", variant: "centered", copy: { headline: "Fresh bread every morning", lede: "Baked at dawn." } };
	const props = organismFor(hero as never)!.props;
	assert.equal(props.title, "Fresh bread every morning");
	assert.equal(props.text, "Baked at dawn.");
	const nav = { id: "block-nav", kind: "nav", title: "Nav", summary: "", catalogBlock: "block.header", variant: "inline", copy: { brand: "Bean & Brew" } };
	assert.equal((organismFor(nav as never)!.props.labels as Record<string, string>).brand, "Bean & Brew");
});

test("tool schemas carry variant, row icon and set_variant (no hardcoded value lists)", () => {
	const propose = JSON.stringify(proposeContentParameterSchema());
	assert.match(propose, /"variant"/);
	assert.match(propose, /"icon"/);
	const edit = JSON.stringify(editPageParameterSchema());
	assert.match(edit, /set_variant/);
	assert.doesNotMatch(propose + edit, /tiles4|cells4|rowsAlternate/);
});

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

test("CSS: theme and tokens only from the registry tree; the chat declares no colour tokens of its own", () => {
	const app = readFileSync(join(ROOT, "apps/chat-web/src/app.css"), "utf8");
	assert.match(app, /@import "\.\.\/\.\.\/\.\.\/registry\/svelte\/src\/styles\/theme\.css"/);
	assert.match(app, /@import "\.\.\/\.\.\/\.\.\/registry\/svelte\/src\/styles\/kit\.css"/);
	const frame = readFileSync(join(ROOT, "apps/chat-web/src/preview-frame.css"), "utf8");
	assert.match(frame, /@import "\.\.\/\.\.\/\.\.\/registry\/svelte\/src\/styles\/index\.css"/);
	const theme = readFileSync(join(ROOT, "registry/svelte/src/styles/theme.css"), "utf8");
	assert.match(theme, /@custom-variant dark \(&:is\(\.dark \*, \[data-theme="dark"\] \*\)\)/);
	for (const file of walk(join(ROOT, "apps/chat-web/src")).filter((path) => path.endsWith(".css"))) {
		assert.doesNotMatch(readFileSync(file, "utf8"), /--(background|foreground|primary|border|radius)\s*:/, `${file} redeclares a registry token`);
	}
});

test("layout: lib holds only logic (no .svelte), no chat-owned 'compose' path, no own primitives", () => {
	const src = join(ROOT, "apps/chat-web/src");
	const files = walk(src).map((path) => path.slice(src.length + 1).split("\\").join("/"));
	assert.deepEqual(files.filter((path) => path.startsWith("lib/") && path.endsWith(".svelte")), []);
	assert.deepEqual(files.filter((path) => /(^|\/)compose(\/|\.|$)/i.test(path)), []);
	assert.deepEqual(files.filter((path) => path.startsWith("ui/") || path.startsWith("utils/") || path.startsWith("registry/")), []);
	for (const file of files.filter((path) => path.endsWith(".svelte"))) {
		const text = readFileSync(join(src, file), "utf8");
		for (const [, spec] of text.matchAll(/from "([^"]+\.svelte)"/g)) {
			// $lib/x.svelte names a runes module (x.svelte.ts): lib holds no components (asserted above).
			assert.ok(["$registry/", "$lib/", "./", "../app/", "../../app/"].some((prefix) => spec!.startsWith(prefix)), `${file} imports ${spec}`);
		}
	}
});

/**
 * Registry sources of catalog blocks: the pinned registry snapshot (sha256 lockfile), variant -> props presets
 * generated from the compose-gen block specs, variant and icon validation in propose_layout / edit_page /
 * get_block_details, the page block -> organism props mapping, and the scoped preview CSS.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { pageSpecIssues, type Page } from "../../packages/page-contract/src/index.ts";
import {
	catalogSources,
	editPage,
	editPageParameterSchema,
	executeTool,
	isLucideIcon,
	organismFor,
	proposeContentParameterSchema,
	proposeLayout,
	type LayoutProposal
} from "../../packages/builder-core/src/index.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const NOW = "2026-11-09T12:00:00.000Z";
const FEATURES = catalogSources.blocks["block.features"]!;

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

test("registry snapshot: every vendored file matches the lockfile sha256 (offline)", () => {
	const run = spawnSync(process.execPath, ["scripts/registry-snapshot.mjs", "--check"], { cwd: ROOT, encoding: "utf8" });
	assert.equal(run.status, 0, run.stderr || run.stdout);
	assert.match(run.stdout, /all sha256 match/);
	const lock = JSON.parse(readFileSync(new URL("../../registry/registry.lock.json", import.meta.url), "utf8")) as {
		items: Array<{ name: string; url: string; status: number; sha256: string; files: Array<{ sha256: string }> }>;
	};
	assert.ok(lock.items.some((item) => item.name === "feature-grid"));
	for (const item of lock.items) {
		assert.match(item.url, /^https:\/\/registry\.buildy\.tw\/svelte\/(blocks|components|components\/ui|lib|utils)\/[a-z0-9-]+\.json$/);
		assert.equal(item.status, 200);
		assert.match(item.sha256, /^sha256:[0-9a-f]{64}$/);
		for (const file of item.files) assert.match(file.sha256, /^sha256:[0-9a-f]{64}$/);
	}
});

test("variant presets are generated from the pinned compose-gen spec, every prop is an axis value", () => {
	assert.equal(FEATURES.item, "feature-grid");
	assert.equal(FEATURES.defaultVariant, "grid");
	assert.match(catalogSources.specs.commit, /^[0-9a-f]{40}$/);
	assert.ok(catalogSources.specs.files.every((file) => /^sha256:[0-9a-f]{64}$/.test(file.sha256)));
	assert.ok(Object.keys(FEATURES.variants).length >= 2);
	for (const [id, preset] of Object.entries(FEATURES.variants)) {
		for (const [axis, value] of Object.entries(preset.props)) assert.ok(FEATURES.axes[axis]?.includes(value), `${id}: ${axis}=${value}`);
	}
	assert.deepEqual(FEATURES.variants.grid!.props, FEATURES.defaults);
	assert.ok(isLucideIcon(FEATURES.fallbackIcon));
	assert.ok(catalogSources.icons.length > 100);
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
	assert.equal((icon as { code: string }).code, "unknown_icon");
	assert.match((icon as { path: string }).path, /icon/);
});

test("get_block_details keeps the requested variant and returns the registry presets", () => {
	const r = executeTool({ name: "get_block_details", arguments: { id: "features", variant: "grid2" } });
	assert.equal(r.ok, true, JSON.stringify(r));
	const details = r.result as { variant?: string; registry?: { item: string; variantProps: Record<string, string>; icons: string[] } };
	assert.equal(details.variant, "grid2");
	assert.equal(details.registry?.item, "feature-grid");
	assert.deepEqual(details.registry?.variantProps, FEATURES.variants.grid2!.props);
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

test("organism props: variant preset, slot mapping, fallback icon for a row without one", () => {
	const r = propose({ variant: "cells4", action: { label: "View all", href: "#/features" }, items: [{ label: "Fast", detail: "Static pages.", icon: "zap" }, { label: "Plain", detail: "No icon." }] });
	assert.equal(r.ok, true, JSON.stringify(r));
	const block = features((r.result as LayoutProposal).page);
	const render = organismFor(block)!;
	assert.equal(render.organism, "blocks/feature-grid.svelte");
	assert.equal(render.variant, "cells4");
	assert.deepEqual(Object.fromEntries(Object.keys(FEATURES.axes).map((axis) => [axis, render.props[axis]])), FEATURES.variants.cells4!.props);
	assert.equal(render.props.id, block.id);
	assert.equal(render.props.title, block.title);
	assert.deepEqual(render.props.action, { label: "View all", href: "#/features" });
	const rows = render.props.features as Array<{ title: string; text: string; icon: string }>;
	assert.deepEqual(rows.map((row) => row.icon), ["zap", FEATURES.fallbackIcon]);
	assert.equal(rows[0]!.text, "Static pages.");
	assert.equal(organismFor({ ...block, catalogBlock: undefined }), null);
});

test("tool schemas carry variant, row icon and set_variant (no hardcoded value lists)", () => {
	const propose = JSON.stringify(proposeContentParameterSchema());
	assert.match(propose, /"variant"/);
	assert.match(propose, /"icon"/);
	const edit = JSON.stringify(editPageParameterSchema());
	assert.match(edit, /set_variant/);
	assert.doesNotMatch(propose + edit, /tiles4|cells4|rowsAlternate/);
});

test("preview CSS: kit tokens only inside .ui8kit-preview of the preview frame, dark by class or data-theme", () => {
	const css = readFileSync(new URL("../../apps/chat-web/src/registry/preview-kit.css", import.meta.url), "utf8");
	assert.match(css, /:is\(\.dark, \[data-theme="dark"\]\) \.ui8kit-preview/);
	assert.doesNotMatch(css, /Istok/);
	const selectors = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/^([^\s@{}][^{]*)\{/gm)].map((match) => match[1]!.trim());
	assert.ok(selectors.length > 5);
	for (const selector of selectors) assert.match(selector, /\.ui8kit-preview/, selector);
	const app = readFileSync(new URL("../../apps/chat-web/src/app.css", import.meta.url), "utf8");
	assert.match(app, /@custom-variant dark \(&:is\(\.dark \*, \[data-theme="dark"\] \*\)\)/);
	// The kit theme lives only in the preview iframe's stylesheet, not in the chat page.
	assert.doesNotMatch(app, /preview-kit\.css/);
	assert.match(app, /@source not "\.\/registry"/);
	const frame = readFileSync(new URL("../../apps/chat-web/src/preview-frame.css", import.meta.url), "utf8");
	assert.match(frame, /@import "\.\/registry\/preview-kit\.css"/);
	assert.match(frame, /@custom-variant dark \(&:is\(\.dark \*, \[data-theme="dark"\] \*\)\)/);
});

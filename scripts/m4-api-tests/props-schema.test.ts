/**
 * Published props schemas (registry.buildy.tw/props/v0.json, pinned in registry/props.v0.json): the pin, the lossless
 * compact copy the chat reads, and the program-level props gate (Ajv 2020, strict) on the merged props of every
 * registry block of a proposal or a page-patch.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { Page } from "../../packages/page-contract/src/index.ts";
import {
	catalogSources,
	editPage,
	executeTool,
	getBlockDetails,
	lucideIcons,
	modelCatalogSources,
	organismFor,
	propsDigest,
	propsEventsFor,
	propsSchemaFor,
	proposeLayout,
	setPropsValidator,
	validateCatalogProvenance,
	type LayoutProposal
} from "../../packages/builder-core/src/index.ts";
import { installPropsGate, validateRegistryProps } from "../../packages/builder-core/src/catalog/props-gate.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const NOW = "2026-11-10T12:00:00.000Z";
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

function website() {
	const r = proposeLayout({ brief: "Website for a coffee house", scenarioId: "website", screenId: "screen.site/home", expectedRevision: 0, now: NOW, content: { locale: "en", blocks: [] } });
	assert.ok(r.ok, JSON.stringify(r));
	return { page: r.page, provenance: { screenId: r.provenance.screenId, scenarioId: "website" as const, missing: r.missing } };
}

const features = (page: Page) => page.layout.blocks.find((block) => block.kind === "features")!;

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

test("propose_layout: an unknown icon is rejected by the schema enum, the allowed names are the schema's own", () => {
	const r = executeTool(
		{ name: "propose_layout", arguments: { brief: "Landing", screenId: "screen.site/home", locale: "en", blocks: [{ kind: "features", title: "Features", items: [{ label: "Home", icon: "home" }, { label: "Bars", icon: "bar-chart" }] }] } },
		{ liveTurn: true, authorBrief: "Landing with features" }
	) as { ok: false; code: string; message: string; path: string };
	assert.equal(r.ok, false);
	assert.equal(r.code, "props_invalid");
	assert.match(r.path, /^layout\.blocks\[\d+\]\.children\[0\]\.copy\.icon$/);
	assert.match(r.message, /\/features\/0\/icon "home".*Allowed: .*\bhouse\b/);
	// Every allowed name is the schema's own enum, inline, so one retry needs no other tool call.
	const allowed = r.message.slice(r.message.indexOf("Allowed: ") + "Allowed: ".length).split(".")[0]!.split(", ");
	assert.deepEqual(allowed, lucideIcons());
	const fixed = executeTool(
		{ name: "propose_layout", arguments: { brief: "Landing", screenId: "screen.site/home", locale: "en", blocks: [{ kind: "features", title: "Features", items: [{ label: "Home", icon: "house" }] }] } },
		{ liveTurn: true, authorBrief: "Landing with features" }
	);
	assert.equal(fixed.ok, true, JSON.stringify(fixed));
});

test("propose_layout: an icon on a row whose page-spec slot renders none is not carried (no rejection)", () => {
	const r = executeTool(
		{ name: "propose_layout", arguments: { brief: "Dashboard", screenId: "screen.theme-dashboard-console/home", scenarioId: "dashboard", locale: "en", blocks: [{ kind: "nav", title: "Nav", brand: "Ops", items: [{ label: "Home", icon: "home" }, { label: "Reports", icon: "bar-chart" }] }] } },
		{ liveTurn: true, authorBrief: "Dashboard" }
	);
	assert.equal(r.ok, true, JSON.stringify(r));
	const nav = (r.result as LayoutProposal).page.layout.blocks.find((block) => block.kind === "nav")!;
	assert.ok((nav.children ?? []).every((child) => child.copy?.icon === undefined));
});

test("edit_page: set_items with an unknown icon, set_variant and copy edits are all validated on the merged props", () => {
	const { page, provenance } = website();
	const block = features(page);
	const base = { page, provenance, expectedRevision: 1, now: NOW };
	const bad = editPage({ ...base, patch: { ops: [{ op: "set_items", blockId: block.id, items: [{ label: "Beans", icon: "coffee-beans" }] }] } }) as { ok: false; code: string; path: string };
	assert.equal(bad.ok, false);
	assert.equal(bad.code, "props_invalid");
	assert.match(bad.path, /children\[0\]\.copy\.icon$/);
	const good = editPage({ ...base, patch: { ops: [{ op: "set_items", blockId: block.id, items: [{ label: "Beans", icon: "star" }] }, { op: "set_variant", blockId: block.id, variant: "rows" }, { op: "set", blockId: block.id, field: "title", value: "Fresh beans" }] } });
	assert.ok(good.ok, JSON.stringify(good));
	const render = organismFor(features((good as LayoutProposal).page))!;
	assert.equal(render.variant, "rows");
	assert.equal(render.props.title, "Fresh beans");
	assert.deepEqual(validateRegistryProps(render), []);
});

test("the gate is fail-closed: without a validator a page with a registry block is rejected", () => {
	const { page, provenance } = website();
	setPropsValidator(null);
	try {
		const r = validateCatalogProvenance({ page, screenId: provenance.screenId });
		assert.equal(r.ok, false);
		assert.equal((r as { code: string }).code, "props_gate_unavailable");
	} finally {
		installPropsGate();
	}
	assert.equal(validateCatalogProvenance({ page, screenId: provenance.screenId }).ok, true);
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

test("model context and block details come from the schema: no hand-written field hints, icons from the enum", () => {
	const context = modelCatalogSources() as { blocks: Record<string, Record<string, string>>; icons: string[] };
	assert.deepEqual(context.icons, lucideIcons());
	assert.match(context.blocks["block.features"]!.rows!, /^features\[\]: .*\bicon:icon\b/);
	assert.equal(JSON.stringify(context).includes("rowIcon"), false);
	const details = getBlockDetails({ id: "features" }) as { registry: { icons: string[]; schema: Record<string, string> } };
	assert.deepEqual(details.registry.icons, lucideIcons());
	assert.match(details.registry.schema.rows!, /features\[\]/);
});

test("no hand-written icon allowlist or synonyms remain in the chat program", () => {
	for (const file of ["content.ts", "patch.ts", "catalog/provenance.ts", "catalog/organism.ts", "catalog/sources.ts", "catalog/details.ts"]) {
		const text = read(`packages/builder-core/src/${file}`);
		assert.doesNotMatch(text, /isLucideIcon|lucideIconHint|unknown_icon|"bar-chart"|"home"/, file);
	}
	assert.equal("icons" in (JSON.parse(read("packages/builder-core/src/catalog/sources.json")) as object), false);
});

/**
 * Build inspector (WP FastY Builder mechanics on the chat's own contracts): block identity on the canvas, editor
 * chrome drawn by the chat over the frame (never in the page), the schema-driven field model, validated write-back,
 * local history and block operations.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { PageBlock } from "../../packages/page-contract/src/index.ts";
import { blockSelector, overlayRect, sameRect, topLevelBlockId } from "../../apps/chat-web/src/lib/inspector/geometry.ts";

const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");

const tree: PageBlock[] = [
	{ id: "block-nav", kind: "nav", title: "Nav", summary: "n", children: [{ id: "block-nav-link-1", kind: "nav-link", title: "A", summary: "a" }] },
	{ id: "block-hero", kind: "hero", title: "Hero", summary: "h" }
];

test("canvas: a row selects its top-level block; unknown ids select nothing", () => {
	assert.equal(topLevelBlockId(tree, "block-hero"), "block-hero");
	assert.equal(topLevelBlockId(tree, "block-nav-link-1"), "block-nav");
	assert.equal(topLevelBlockId(tree, "nope"), null);
	assert.equal(topLevelBlockId(tree, null), null);
});

test("canvas: block selector quotes the id; overlay rects follow the frame scale and skip off-screen blocks", () => {
	assert.equal(blockSelector('a"b\\c'), '[data-block-id="a\\"b\\\\c"]');
	const viewport = { width: 1280, height: 800 };
	assert.deepEqual(overlayRect({ x: 0, y: 100, width: 1280, height: 400 }, 0.5, viewport), { x: 0, y: 50, width: 640, height: 200 });
	assert.equal(overlayRect({ x: 0, y: 900, width: 1280, height: 400 }, 1, viewport), null);
	assert.equal(overlayRect({ x: 0, y: -500, width: 1280, height: 400 }, 1, viewport), null);
	assert.equal(overlayRect({ x: 0, y: 0, width: 0, height: 0 }, 1, viewport), null);
	assert.ok(sameRect({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 4 }));
	assert.ok(!sameRect({ x: 1, y: 2, width: 3, height: 4 }, null));
});

test("canvas: blocks carry data-block-id; chrome lives in the chat document, not in the page", () => {
	const block = web("app/PreviewBlock.svelte");
	assert.match(block, /data-block-id=\{block\.id\}/);
	assert.doesNotMatch(block, /outline-/, "no selection outline inside the page");
	assert.match(block, /onpointerenter=\{standalone \? undefined/);
	const pane = web("app/PreviewPane.svelte");
	assert.match(pane, /\{#if frameDoc && !clean\}\s*<CanvasOverlay/);
	const overlay = web("app/CanvasOverlay.svelte");
	assert.match(overlay, /getBoundingClientRect/);
	assert.match(overlay, /MutationObserver/);
	assert.match(overlay, /ResizeObserver/);
	assert.match(overlay, /addEventListener\("scroll"/);
	assert.doesNotMatch(overlay, /\sstyle=/, "geometry is set by an attachment, not a style attribute");
	assert.doesNotMatch(web("app/StandalonePreview.svelte"), /CanvasOverlay|BlockTree/);
	const workspace = web("app/Workspace.svelte");
	assert.match(workspace, /\{#if build\}\s*<BlockTree \/>/);
	assert.match(web("app/BlockTree.svelte"), /canvas\.hover\(block\.id\)/);
});

// ---- Step 2: schema-driven field model -------------------------------------------------------------------------

import { inspectorModel, proposeLayout, type InspectorField } from "../../packages/builder-core/src/index.ts";
import { closestAllowed, fieldDomId, partitionFields } from "../../apps/chat-web/src/lib/inspector/fields.ts";

const NOW = "2026-11-10T12:00:00.000Z";

function landing() {
	const r = proposeLayout({ brief: "Landing for a coffee house", scenarioId: "landing", screenId: null, expectedRevision: 0, now: NOW, content: { locale: "en", blocks: [] } });
	assert.ok(r.ok, JSON.stringify(r));
	return { page: r.page, provenance: { screenId: r.provenance.screenId, scenarioId: "landing" as const, missing: r.missing } };
}

const byPointer = (fields: InspectorField[], pointer: string): InspectorField | undefined => {
	for (const field of fields) {
		if (field.pointer === pointer) return field;
		const inner = byPointer([...(field.fields ?? []), ...(field.rows ?? []).flatMap((row) => row.fields)], pointer);
		if (inner) return inner;
	}
	return undefined;
};

test("inspector model: fields come from the pinned schema, values from the render, origins from organismFor", () => {
	const { page } = landing();
	const hero = page.layout.blocks.find((b) => b.id === "block-hero")!;
	const model = inspectorModel(hero);
	assert.ok(model.ok);
	assert.equal(model.item, "hero-classic");
	assert.ok(model.variants.includes(model.variant));
	const title = byPointer(model.fields, "/title")!;
	assert.equal(title.widget, "text");
	assert.equal(title.origin, "copy.headline");
	assert.equal(title.value, hero.copy?.headline ?? hero.title);
	assert.equal(byPointer(model.fields, "/text")?.widget, "longtext");
	const layout = byPointer(model.fields, "/layout")!;
	assert.equal(layout.widget, "enum");
	assert.equal(layout.origin, null, "variant axes are read-only");
	assert.deepEqual(layout.options, ["centered", "split"]);
	assert.equal(byPointer(model.fields, "/actions/cta")?.origin, "copy.action");
	assert.equal(byPointer(model.fields, "/badge")?.origin, "copy.badge", "an empty copy slot the kind renders is writable");
	assert.equal(byPointer(model.fields, "/id"), undefined, "id is hidden");
});

test("inspector model: list rows map to page rows; row icons write the row's copy.icon", () => {
	const { page } = landing();
	const features = page.layout.blocks.find((b) => b.id === "block-features")!;
	const model = inspectorModel(features);
	assert.ok(model.ok);
	const list = byPointer(model.fields, "/features")!;
	assert.equal(list.widget, "list");
	assert.equal(list.rows?.length, features.children?.length);
	assert.equal(list.rows?.[0]?.origin, "children[0]");
	assert.equal(byPointer(model.fields, "/features/0/title")?.origin, "children[0].title");
	assert.equal(byPointer(model.fields, "/features/0/text")?.origin, "children[0].summary");
	const icon = byPointer(model.fields, "/features/0/icon")!;
	assert.equal(icon.widget, "icon");
	assert.equal(icon.origin, "children[0].copy.icon");
	assert.equal(byPointer(model.fields, "/features/0/id"), undefined);
});

test("inspector model: a block without a registry item is an honest stub", () => {
	const model = inspectorModel({ id: "x", kind: "hero", title: "Hero", summary: "s" });
	assert.equal(model.ok, false);
	assert.equal(!model.ok && model.reason, "not_in_registry");
	for (const locale of ["en", "ru"]) {
		const messages = JSON.parse(web(`lib/i18n/${locale}.json`)).messages;
		for (const key of ["inspector.title", "inspector.stub.not_in_registry", "inspector.stub.no_schema", "inspector.fromVariant", "inspector.allowed"]) {
			assert.ok(messages[key], `${locale}: ${key}`);
		}
	}
});

test("inspector fields: dom ids, content first, closest allowed values", () => {
	assert.equal(fieldDomId("block-hero", "/actions/cta"), "insp-block-hero-actions-cta");
	const fields = [
		{ pointer: "/a", name: "a", widget: "text", required: false, value: undefined, origin: null },
		{ pointer: "/b", name: "b", widget: "text", required: false, value: "x", origin: null },
		{ pointer: "/c", name: "c", widget: "text", required: false, value: undefined, origin: "copy.badge" }
	] satisfies InspectorField[];
	const { main, more } = partitionFields(fields);
	assert.deepEqual(main.map((f) => f.name), ["b", "c"]);
	assert.deepEqual(more.map((f) => f.name), ["a"]);
	assert.deepEqual(closestAllowed("rockett", ["arrow-right", "rocket", "rows"], 2), ["rocket", "rows"]);
	assert.deepEqual(closestAllowed("ro", ["arrow-right", "rocket", "rows"], 3), ["rocket", "rows", "arrow-right"]);
});

test("inspector panel: registry widgets only, mounted in Build", () => {
	const fieldsView = web("app/InspectorFields.svelte");
	for (const widget of ["Input", "Textarea", "Select", "Checkbox", "Fieldset"]) assert.match(fieldsView, new RegExp(`\\$registry/compose/${widget}\\.svelte`));
	assert.doesNotMatch(fieldsView, /<(input|textarea|select|div|span|button)\b/);
	assert.match(web("app/Workspace.svelte"), /\{#if build\}\s*<InspectorPanel/);
	assert.match(web("app/InspectorPanel.svelte"), /inspectorModel\(block\)/);
});

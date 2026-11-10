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

// ---- Step 3: validated write-back and local history ---------------------------------------------------------------

import { inspectorSetField, writeOrigin } from "../../packages/builder-core/src/index.ts";
import { EditHistory } from "../../apps/chat-web/src/lib/inspector/history.ts";

test("write-back: origins map to page-spec fields (title, summary, copy, row copy) and nothing else", () => {
	const block: PageBlock = { id: "b", kind: "features", title: "T", summary: "S", children: [{ id: "r1", kind: "feature", title: "R", summary: "RS" }] };
	assert.equal(writeOrigin(block, "title", "New")?.title, "New");
	assert.equal(writeOrigin(block, "copy.headline", "H")?.copy?.headline, "H");
	const row = writeOrigin(block, "children[0].copy.icon", "rocket")!;
	assert.equal(row.children?.[0]?.copy?.icon, "rocket");
	assert.equal(row.children?.[0]?.title, "R");
	assert.equal(block.children?.[0]?.copy, undefined, "the input block is not mutated");
	assert.equal(writeOrigin(block, "children[0].summary", "x")?.children?.[0]?.summary, "x");
	assert.equal(writeOrigin(block, "children[4].title", "x"), null, "no such row");
	assert.equal(writeOrigin(block, "id", "x"), null, "ids are not writable");
	assert.equal(writeOrigin(block, "catalogBlock", "x"), null);
});

test("write-back: a passing edit changes only its block; other blocks keep their objects", () => {
	const { page } = landing();
	const r = inspectorSetField(page, "block-hero", "/title", "Fresh coffee", NOW);
	assert.ok(r.ok, JSON.stringify(r));
	const hero = r.page.layout.blocks.find((b) => b.id === "block-hero")!;
	assert.equal(hero.copy?.headline, "Fresh coffee");
	for (const [index, node] of r.page.layout.blocks.entries()) {
		if (node.id !== "block-hero") assert.equal(node, page.layout.blocks[index], `${node.id} keeps its object`);
	}
	const model = inspectorModel(hero);
	assert.ok(model.ok);
	assert.equal(byPointer(model.fields, "/title")?.value, "Fresh coffee", "the render shows the edit");
	assert.equal(page.layout.blocks.find((b) => b.id === "block-hero")?.copy?.headline !== "Fresh coffee", true, "base page untouched");
});

test("write-back gate: invalid enum, pattern and empty required values are rejected with pointer and allowed values", () => {
	const { page } = landing();
	const icon = inspectorSetField(page, "block-features", "/features/0/icon", "rockett", NOW);
	assert.equal(icon.ok, false);
	assert.ok(!icon.ok);
	assert.equal(icon.code, "props_invalid");
	assert.equal(icon.pointer, "/features/0/icon");
	assert.ok(icon.allowed?.includes("rocket"), "the contract's Lucide enum is listed");
	const ok = inspectorSetField(page, "block-features", "/features/0/icon", "rocket", NOW);
	assert.ok(ok.ok);
	assert.equal(ok.page.layout.blocks.find((b) => b.id === "block-features")?.children?.[0]?.copy?.icon, "rocket");
	const href = inspectorSetField(page, "block-hero", "/actions/href", "javascript:alert(1)", NOW);
	assert.equal(href.ok, false);
	const empty = inspectorSetField(page, "block-features", "/title", "", NOW);
	assert.equal(empty.ok, false);
	assert.ok(!empty.ok && empty.pointer === "/title");
	const axis = inspectorSetField(page, "block-features", "/layout", "grid", NOW);
	assert.ok(!axis.ok && axis.code === "field_not_editable", "variant axes are not page content");
	assert.equal(inspectorSetField(page, "nope", "/title", "x", NOW).ok, false);
});

test("history: typing in one field is one step until sealed; undo / redo walk the snapshots", () => {
	const h = new EditHistory<string>();
	h.record("a", "ab", "title");
	h.record("ab", "abc", "title");
	h.record("abc", "abcd", "title");
	assert.equal(h.head(), "abcd");
	assert.equal(h.undo(), "a", "three keystrokes are one step");
	assert.equal(h.redo(), "abcd");
	h.seal();
	h.record("abcd", "abcde", "title");
	h.record("abcde", "X", "lede");
	assert.equal(h.undo(), "abcde", "another field is another step");
	assert.equal(h.undo(), "abcd", "a sealed step is not extended");
	assert.equal(h.undo(), "a");
	assert.equal(h.undo(), null);
	assert.equal(h.canRedo, true);
	h.record("a", "op", null);
	assert.equal(h.canRedo, false, "a new edit drops the redo branch");
	h.record("op", "op2", null);
	assert.equal(h.undo(), "op", "operations are never coalesced");
	const small = new EditHistory<number>(2);
	small.record(0, 1); small.record(1, 2); small.record(2, 3);
	assert.equal(small.undo(), 2);
	assert.equal(small.undo(), 1);
	assert.equal(small.undo(), null, "the history keeps at most `limit` steps");
});

test("inspector store: no chat proposal per keystroke; undo keys in Build; frame keys too", () => {
	const store = web("lib/inspector/inspector.svelte.ts");
	assert.match(store, /inspectorSetField\(/);
	assert.match(store, /replaceVisiblePage\(/);
	assert.doesNotMatch(store, /setCandidatePage|sendMessage|applyProposal/);
	assert.match(store, /getChatMode\(\) !== "build"/);
	assert.match(web("app/PreviewPane.svelte"), /doc\.addEventListener\("keydown", inspector\.onKey\)/);
	assert.match(web("app/InspectorPanel.svelte"), /<svelte:window onkeydown=\{inspector\.onKey\} \/>/);
	assert.match(web("app/InspectorFields.svelte"), /onblur=\{canEdit \? \(\) => handlers!\.onseal\(\)/);
});

// ---- Step 4: block operations ---------------------------------------------------------------------------------

import { inspectorOp, type InspectorOp } from "../../packages/builder-core/src/index.ts";

function opContext() {
	const { page, provenance } = landing();
	return { page, provenance, revision: 1, now: NOW };
}
const order = (page: { layout: { blocks: PageBlock[] } }) => page.layout.blocks.map((node) => node.id);
const run = (op: InspectorOp, ctx = opContext()) => ({ ctx, result: inspectorOp(ctx, op) });

test("ops: set_variant goes through the catalog gate; unknown variants fail closed", () => {
	const { ctx, result } = run({ op: "set_variant", blockId: "block-features", variant: "grid2" });
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.page.layout.blocks.find((node) => node.id === "block-features")?.variant, "grid2");
	assert.equal(result.page.layout.blocks[0], ctx.page.layout.blocks[0], "untouched blocks keep their objects");
	const bad = run({ op: "set_variant", blockId: "block-features", variant: "nope" }).result;
	assert.equal(bad.ok, false);
	if (!bad.ok) assert.match(bad.message, /grid2/);
});

test("ops: move, remove and duplicate keep the page valid and return the next selection", () => {
	const moved = run({ op: "move", blockId: "block-cta", to: 1 }).result;
	assert.ok(moved.ok && order(moved.page)[1] === "block-cta" && moved.blockId === "block-cta");
	const removed = run({ op: "remove", blockId: "block-logos" }).result;
	assert.ok(removed.ok && !order(removed.page).includes("block-logos"));
	if (removed.ok) assert.equal(removed.blockId, order(opContext().page)[order(opContext().page).indexOf("block-logos") + 1]);
	const copy = run({ op: "duplicate", blockId: "block-features" }).result;
	assert.ok(copy.ok);
	if (!copy.ok) return;
	const ids = order(copy.page);
	assert.equal(ids[ids.indexOf("block-features") + 1], "block-features-copy");
	assert.equal(copy.blockId, "block-features-copy");
	const twin = copy.page.layout.blocks.find((node) => node.id === "block-features-copy")!;
	const rowIds = (twin.children ?? []).map((row) => row.id);
	assert.ok(rowIds.length > 0 && rowIds.every((id) => id.endsWith("-copy")), "rows get fresh ids");
	const again = inspectorOp({ ...opContext(), page: copy.page }, { op: "duplicate", blockId: "block-features" });
	assert.ok(again.ok && again.blockId === "block-features-copy-2");
	const outOfRange = run({ op: "move", blockId: "block-cta", to: 99 }).result;
	assert.equal(outOfRange.ok, false);
});

test("ops: reset puts back the Stock sample in the current variant; rows respect the slot limit", () => {
	const ctx = opContext();
	const edited = inspectorSetField(ctx.page, "block-hero", "/title", "Edited headline", NOW);
	assert.ok(edited.ok);
	if (!edited.ok) return;
	const reset = inspectorOp({ ...ctx, page: edited.page }, { op: "reset", blockId: "block-hero" });
	assert.ok(reset.ok);
	if (!reset.ok) return;
	const hero = reset.page.layout.blocks.find((node) => node.id === "block-hero")!;
	const stock = ctx.page.layout.blocks.find((node) => node.id === "block-hero")!;
	assert.deepEqual(hero.copy, stock.copy);
	assert.equal(hero.variant, stock.variant);
	assert.equal(inspectorOp({ ...ctx, provenance: null }, { op: "reset", blockId: "block-hero" }).ok, false, "no screen, no sample");

	const features = ctx.page.layout.blocks.find((node) => node.id === "block-features")!;
	const rows = features.children?.length ?? 0;
	const dup = inspectorOp(ctx, { op: "duplicate_row", blockId: "block-features", row: 0 });
	assert.ok(dup.ok && dup.page.layout.blocks.find((node) => node.id === "block-features")!.children!.length === rows + 1);
	const removed = inspectorOp(ctx, { op: "remove_row", blockId: "block-features", row: 0 });
	assert.ok(removed.ok && removed.page.layout.blocks.find((node) => node.id === "block-features")!.children!.length === rows - 1);
	let page = ctx.page;
	for (let n = 0; n < 20; n += 1) {
		const next = inspectorOp({ ...ctx, page }, { op: "duplicate_row", blockId: "block-features", row: 0 });
		if (!next.ok) {
			assert.equal(next.code, "rows_over_limit");
			break;
		}
		page = next.page;
		assert.ok(n < 19, "the row limit is enforced");
	}
	assert.equal(inspectorOp(ctx, { op: "remove_row", blockId: "block-features", row: 99 }).ok, false);
});

test("ops ui: actions, variant select and row actions are registry buttons wired to the store", () => {
	const panel = web("app/InspectorPanel.svelte");
	for (const action of ["move-up", "move-down", "duplicate", "reset", "remove", "variant"]) assert.match(panel, new RegExp(`data-action="${action}"`));
	assert.match(panel, /inspector\.run\(/);
	const fields = web("app/InspectorFields.svelte");
	assert.match(fields, /data-action="duplicate-row"/);
	assert.match(fields, /data-action="remove-row"/);
	assert.match(web("lib/inspector/inspector.svelte.ts"), /run\(op: InspectorOp\)/);
});

test("write-back: writing the current value is a no-op (same page object, no history step)", () => {
	const { page } = landing();
	const hero = page.layout.blocks.find((node) => node.id === "block-hero")!;
	const current = inspectorModel(hero);
	assert.ok(current.ok);
	if (!current.ok) return;
	const title = current.fields.find((field) => field.pointer === "/title")!;
	const same = inspectorSetField(page, "block-hero", "/title", String(title.value), NOW);
	assert.ok(same.ok && same.page === page);
	const store = web("lib/inspector/inspector.svelte.ts");
	assert.match(store, /result\.page === before\) return true/);
	assert.match(store, /!typing && value === String\(field\.value/);
});

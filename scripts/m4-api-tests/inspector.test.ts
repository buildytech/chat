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
	assert.match(web("app/Workspace.svelte"), /\{#if inspectorPanel\.open\}[\s\S]*<InspectorSlideOver/);
	assert.match(web("app/SectionsList.svelte"), /canvas\.hover\(block\.id\)/);
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
	// P1: a field keeps its group while the block stays selected (first keystroke into "More" keeps focus).
	const placed = new Map<string, "main" | "more">();
	partitionFields(fields, placed);
	const typed = partitionFields([{ ...fields[0]!, value: "x" }, fields[1]!, fields[2]!], placed);
	assert.deepEqual(typed.more.map((f) => f.name), ["a"], "stays in More after the first character");
	assert.deepEqual(closestAllowed("rockett", ["arrow-right", "rocket", "rows"], 2), ["rocket", "rows"]);
	assert.deepEqual(closestAllowed("ro", ["arrow-right", "rocket", "rows"], 3), ["rocket", "rows", "arrow-right"]);
});

test("inspector panel: registry widgets only, mounted in Build", () => {
	const fieldsView = web("app/InspectorFields.svelte");
	for (const widget of ["Input", "Textarea", "Select", "Checkbox", "Fieldset"]) assert.match(fieldsView, new RegExp(`\\$registry/compose/${widget}\\.svelte`));
	assert.doesNotMatch(fieldsView, /<(input|textarea|select|div|span|button)\b/);
	// ADR 0024 step D: the inspector is a slide-over on the preview (Sections is the outline in the left panel).
	assert.match(web("app/InspectorSlideOver.svelte"), /<InspectorPanel \/>/);
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
	// P1 (page-spec 1.3.0): a field no copy slot maps is a props override, checked against the item's props schema.
	const axis = inspectorSetField(page, "block-features", "/layout", "neon", NOW);
	assert.ok(!axis.ok && axis.code === "props_invalid" && axis.allowed?.includes("grid"), "an enum outside the schema is rejected");
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

test("inspector store: no chat proposal per keystroke; undo keys in Ask and Build; frame keys too", () => {
	const store = web("lib/inspector/inspector.svelte.ts");
	assert.match(store, /inspectorSetField\(/);
	assert.match(store, /replaceVisiblePage\(/);
	assert.doesNotMatch(store, /setCandidatePage|sendMessage|applyProposal/);
	assert.doesNotMatch(store, /getChatMode\(\) !== "build"/);
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

// ---- Inspector P0 (ADR 0024 addendum): honest locks, axis selects, empty mapped fields, link reasons ---------------

import { emptyPageStart, writableOrigin as writableOriginOf, organismFor as organismOf } from "../../packages/builder-core/src/index.ts";
import { axisAction, axisSwitch, issueText, lockHint, LOCKED_CONTROL } from "../../apps/chat-web/src/lib/inspector/fields.ts";

function emptyStartWith(adds: Array<[string, string]>) {
	const start = emptyPageStart({ kind: "hero", title: "New page", now: NOW })!;
	let page = start.page;
	for (const [catalogBlock, variant] of adds) {
		const r = inspectorOp({ page, provenance: start.provenance, revision: 1, now: NOW }, { op: "add", blockId: "", catalogBlock, variant });
		assert.ok(r.ok, JSON.stringify(r));
		page = r.page;
	}
	return { page, provenance: start.provenance };
}

test("P0/P1 sources: every non-copy field names where its value comes from (variant / sample / no page field)", () => {
	const { page } = emptyStartWith([["block.herosplit", "miniCards"]]);
	const hero = page.layout.blocks[0]!;
	const model = inspectorModel(hero);
	assert.ok(model.ok);
	assert.equal(model.item, "hero-split");
	const f = (p: string) => byPointer(model.fields, p)!;
	assert.equal(f("/extra").from, "variant");
	assert.equal(f("/content/card/title").from, "sample", "the schema fills \"Title\"; not the variant");
	assert.equal(f("/content/proof").from, "sample");
	assert.equal(f("/actions/secondary").from, "no_page_field");
	assert.equal(f("/landmarkLabel").from, "no_page_field");
	for (const pointer of ["/extra", "/content/card/title", "/actions/secondary", "/landmarkLabel"]) {
		assert.equal(f(pointer).prop, true, `${pointer} is a props override`);
		assert.equal(f(pointer).lock, undefined, `${pointer} is not locked any more`);
	}
	assert.equal(f("/title").from, undefined, "copy fields carry no source note");
	assert.equal(f("/content").lock, undefined, "objects carry no lock; their fields do");
	assert.equal(lockHint(f("/content/card/title")), "inspector.prop.sample");
	assert.equal(lockHint(f("/actions/secondary")), "inspector.prop.unset");
	assert.equal(lockHint(f("/title")), null);
	const classic = inspectorModel(emptyStartWith([["block.hero", "centered"]]).page.layout.blocks[0]!);
	assert.ok(classic.ok);
	assert.equal(byPointer(classic.fields, "/actions/mode")?.from, "variant", "a value the variant preset sets");
	assert.equal(lockHint(byPointer(classic.fields, "/actions/mode")!), "inspector.prop.variant");
});

test("P0/P1 axes: a value with a named variant switches to it, any other value overrides the axis", () => {
	const { page } = emptyStartWith([["block.hero", "centered"], ["block.herosplit", "miniCards"]]);
	const classic = inspectorModel(page.layout.blocks[0]!);
	assert.ok(classic.ok);
	const scale = byPointer(classic.fields, "/scale")!;
	assert.deepEqual(scale.choices, [{ value: "default", variant: "centered" }, { value: "display", variant: "display" }]);
	assert.equal(axisSwitch(scale, true), true);
	assert.equal(axisSwitch(scale, false), false, "no host handler: no switch");
	assert.equal(lockHint(scale), "inspector.prop.axis");
	assert.deepEqual(axisAction(scale, "display", "centered"), { variant: "display" });
	const split = inspectorModel(page.layout.blocks[1]!);
	assert.ok(split.ok);
	const side = byPointer(split.fields, "/mediaSide")!;
	assert.deepEqual(side.choices, [{ value: "end", variant: "miniCards" }, { value: "start", variant: null }], "no named preset with start");
	assert.equal(axisSwitch(side, true), true, "the axis is overridable");
	assert.deepEqual(axisAction(side, "start", "miniCards"), { override: "start" });
	// The switch is an ordinary set_variant through every gate.
	const ctx = { page, provenance: emptyStartWith([]).provenance, revision: 1, now: NOW };
	const r = inspectorOp(ctx, { op: "set_variant", blockId: page.layout.blocks[0]!.id, variant: "display" });
	assert.ok(r.ok, JSON.stringify(r));
	assert.equal(r.page.layout.blocks[0]!.variant, "display");
	assert.equal(r.op, "set_variant");
});

test("P0 empty mapped fields: action label / href, lead and empty state are writable via writableOrigin", () => {
	const { page } = emptyStartWith([["block.features", "grid2"]]);
	const features = page.layout.blocks[0]!;
	const model = inspectorModel(features);
	assert.ok(model.ok);
	assert.equal(byPointer(model.fields, "/action/label")?.origin, "copy.action");
	assert.equal(byPointer(model.fields, "/action/href")?.origin, "copy.href");
	assert.equal(byPointer(model.fields, "/empty")?.origin, null, "rows exist: the empty state is not shown");
	const r = inspectorSetField(page, features.id, "/action/label", "See all", NOW);
	assert.ok(r.ok, JSON.stringify(r));
	assert.equal(r.page.layout.blocks[0]!.copy?.action, "See all");
	const after = inspectorModel(r.page.layout.blocks[0]!);
	assert.ok(after.ok);
	assert.equal(byPointer(after.fields, "/action/label")?.value, "See all", "the render shows it");
	// No rows: the empty state reads (and writes) the block lede.
	const bare: PageBlock = { ...features, children: undefined };
	delete (bare as { children?: unknown }).children;
	const render = organismOf(bare)!;
	const noSummary = { ...bare, summary: undefined } as unknown as PageBlock;
	assert.equal(writableOriginOf(noSummary, organismOf(noSummary)!, "/empty"), "summary");
	void render;
	// A hero with no lede yet: its lead prop writes copy.lede.
	const hero = emptyStartWith([["block.herosplit", "miniCards"]]).page.layout.blocks[0]!;
	const noLede: PageBlock = { ...hero, copy: { ...hero.copy, lede: undefined } };
	delete noLede.copy!.lede;
	const bareHero = { ...noLede, summary: undefined } as unknown as PageBlock;
	assert.equal(writableOriginOf(bareHero, organismOf(bareHero)!, "/lead"), "copy.lede");
});

test("P0 links: a rejected link says why, in the field's words", () => {
	const { page } = emptyStartWith([["block.herosplit", "miniCards"]]);
	const id = page.layout.blocks[0]!.id;
	const bad = inspectorSetField(page, id, "/actions/href", "Probe text", NOW);
	assert.ok(!bad.ok);
	assert.equal(bad.code, "link_invalid");
	assert.equal(bad.pointer, "/actions/href");
	for (const good of ["#offer", "/pricing", "https://example.com", "mailto:a@b.co"]) assert.ok(inspectorSetField(page, id, "/actions/href", good, NOW).ok, good);
	const text = issueText({ pointer: "/actions/href", code: "link_invalid", message: bad.message, value: "Probe text" }, (key) => (key === "inspector.linkInvalid" ? "\"{value}\" is not a link." : key));
	assert.equal(text, "\"Probe text\" is not a link.");
});

test("P0 unshown copy: a hero eyebrow this block cannot show is listed, not dropped silently", () => {
	const { page } = emptyStartWith([["block.hero", "centered"]]);
	const model = inspectorModel(page.layout.blocks[0]!);
	assert.ok(model.ok);
	const eyebrow = model.unshown.find((entry) => entry.key === "eyebrow");
	assert.ok(eyebrow, "hero-classic has no eyebrow prop");
	assert.equal(eyebrow.value, page.layout.blocks[0]!.copy?.eyebrow);
	assert.equal(model.unshown.some((entry) => entry.key === "headline" || entry.key === "lede" || entry.key === "action"), false, "shown keys are not listed");
});

test("P0 ui: locked controls are muted, aria-readonly, with a lock icon; axis selects run set_variant; en + ru", () => {
	const view = web("app/InspectorFields.svelte");
	assert.match(view, /aria-readonly=\{canEdit \? undefined : "true"\}/);
	assert.match(view, /class=\{canEdit \? undefined : LOCKED_CONTROL\}/);
	assert.match(view, /@lucide\/svelte\/icons\/lock/);
	assert.match(view, /handlers\?\.onvariant\?\.\(action\.variant\)/);
	assert.match(LOCKED_CONTROL, /cursor-not-allowed/);
	assert.match(LOCKED_CONTROL, /bg-muted/);
	const panel = web("app/InspectorPanel.svelte");
	assert.match(panel, /onvariant: \(variant\) =>[\s\S]*op: "set_variant"/);
	assert.match(panel, /data-slot="inspector-unshown"/);
	for (const locale of ["en", "ru"]) {
		const messages = JSON.parse(web(`lib/i18n/${locale}.json`)).messages;
		for (const key of ["inspector.locked", "inspector.lock.axis", "inspector.lock.axisNone", "inspector.lock.variant", "inspector.lock.sample", "inspector.lock.noField", "inspector.notShown", "inspector.notShownTitle", "inspector.linkInvalid"]) {
			assert.ok(messages[key], `${locale}: ${key}`);
		}
	}
});

// ---- Inspector P1 (ADR 0024 addendum): block props overrides (page-spec 1.3.0) and history op/path (session 1.6.0) --

import { editPage, swapCatalogBlock } from "../../packages/builder-core/src/index.ts";
import { carryPropsOverrides } from "../../packages/builder-core/src/catalog/organism.ts";
import { checkBlockProps } from "../../packages/builder-core/src/catalog/provenance.ts";
import { parsePage as parsePageOf } from "../../packages/page-contract/src/index.ts";
import { SESSION_REVISION_OPS } from "../../packages/page-contract/src/session.ts";
import { sveltePackFiles } from "../../apps/chat-web/src/lib/page-store/svelte-code.ts";

function miniCards() {
	const { page, provenance } = emptyStartWith([["block.herosplit", "miniCards"]]);
	return { page, provenance, id: page.layout.blocks[0]!.id };
}
const blockOf = (page: { layout: { blocks: PageBlock[] } }, id: string) => page.layout.blocks.find((node) => node.id === id)!;

test("P1 override: a field no copy slot maps is written to block.props, shows in the render, and survives parse", () => {
	const { page, id } = miniCards();
	const r = inspectorSetField(page, id, "/actions/secondary", "Book a call", NOW);
	assert.ok(r.ok, JSON.stringify(r));
	assert.equal(r.op, "set_field");
	assert.equal(r.path, "/actions/secondary");
	const block = blockOf(r.page, id);
	assert.deepEqual(block.props, { "/actions/secondary": "Book a call" });
	const model = inspectorModel(block);
	assert.ok(model.ok);
	const field = byPointer(model.fields, "/actions/secondary")!;
	assert.equal(field.value, "Book a call");
	assert.equal(field.overridden, true);
	assert.equal(lockHint(field), "inspector.prop.overridden");
	assert.deepEqual(parsePageOf(JSON.parse(JSON.stringify(r.page))).layout.blocks[0]!.props, block.props, "page-spec 1.3.0 accepts it");
	// Sample placeholders and variant values are overridable too; enums and links go through the schema.
	const card = inspectorSetField(r.page, id, "/content/card/title", "Roastery tour", NOW);
	assert.ok(card.ok, JSON.stringify(card));
	const tone = inspectorSetField(card.page, id, "/tone", "default", NOW);
	assert.ok(tone.ok, JSON.stringify(tone));
	assert.equal(blockOf(tone.page, id).props?.["/tone"], "default");
	const badEnum = inspectorSetField(card.page, id, "/tone", "neon", NOW);
	assert.ok(!badEnum.ok && badEnum.code === "props_invalid" && badEnum.allowed?.includes("muted"));
	const badLink = inspectorSetField(card.page, id, "/actions/secondaryHref", "Probe text", NOW);
	assert.ok(!badLink.ok && badLink.code === "link_invalid");
	// Copy slots still win: the headline writes copy.headline, never props.
	const title = inspectorSetField(card.page, id, "/title", "Fresh", NOW);
	assert.ok(title.ok);
	assert.equal(blockOf(title.page, id).copy?.headline, "Fresh");
	assert.equal(blockOf(title.page, id).props?.["/title"], undefined);
});

test("P1 lists: props list rows add, edit, move and remove; page rows move and keep their row overrides", () => {
	const { page, provenance, id } = miniCards();
	const ctx = { page, provenance, revision: 1, now: NOW };
	const add = inspectorOp(ctx, { op: "list_row", blockId: id, pointer: "/content/features", action: "add" });
	assert.ok(add.ok, JSON.stringify(add));
	assert.equal(add.op, "insert");
	assert.equal(add.path, "/content/features/0", "the path names the new row");
	const two = inspectorOp({ ...ctx, page: add.page }, { op: "list_row", blockId: id, pointer: "/content/features", action: "add" });
	assert.ok(two.ok, JSON.stringify(two));
	let model = inspectorModel(blockOf(two.page, id));
	assert.ok(model.ok);
	const list = byPointer(model.fields, "/content/features")!;
	assert.equal(list.rows?.length, 2);
	const rowTitle = byPointer(model.fields, "/content/features/1/title");
	assert.ok(rowTitle?.prop, "props list row fields are overridable");
	const edit = inspectorSetField(two.page, id, "/content/features/1/title", "Second", NOW);
	assert.ok(edit.ok, JSON.stringify(edit));
	assert.equal(Object.keys(blockOf(edit.page, id).props ?? {}).join(), "/content/features", "a list is overridden whole at the list pointer");
	const up = inspectorOp({ ...ctx, page: edit.page }, { op: "list_row", blockId: id, pointer: "/content/features", action: "up", row: 1 });
	assert.ok(up.ok, JSON.stringify(up));
	assert.equal(up.op, "move");
	model = inspectorModel(blockOf(up.page, id));
	assert.ok(model.ok);
	assert.equal(byPointer(model.fields, "/content/features/0/title")?.value, "Second");
	const removed = inspectorOp({ ...ctx, page: up.page }, { op: "list_row", blockId: id, pointer: "/content/features", action: "remove", row: 0 });
	assert.ok(removed.ok && removed.op === "remove");
	model = inspectorModel(blockOf(removed.page, id));
	assert.ok(model.ok);
	assert.equal(byPointer(model.fields, "/content/features")?.rows?.length, 1);

	const grid = emptyStartWith([["block.features", "grid2"]]);
	const fid = grid.page.layout.blocks[0]!.id;
	const href = inspectorSetField(grid.page, fid, "/features/1/href", "#evidence", NOW);
	assert.ok(href.ok, JSON.stringify(href));
	const titles = (p: typeof grid.page) => (blockOf(p, fid).children ?? []).map((row) => row.title);
	const before = titles(href.page);
	const moved = inspectorOp({ page: href.page, provenance: grid.provenance, revision: 1, now: NOW }, { op: "list_row", blockId: fid, pointer: "/features", action: "up", row: 1 });
	assert.ok(moved.ok, JSON.stringify(moved));
	assert.deepEqual(titles(moved.page), [before[1], before[0], ...before.slice(2)]);
	assert.deepEqual(blockOf(moved.page, fid).props, { "/features/0/href": "#evidence" }, "the row override follows its row");
	const addRow = inspectorOp({ page: moved.page, provenance: grid.provenance, revision: 1, now: NOW }, { op: "list_row", blockId: fid, pointer: "/features", action: "add" });
	assert.ok(addRow.ok && (blockOf(addRow.page, fid).children ?? []).length === before.length + 1);
	const dropRow = inspectorOp({ page: moved.page, provenance: grid.provenance, revision: 1, now: NOW }, { op: "list_row", blockId: fid, pointer: "/features", action: "remove", row: 0 });
	assert.ok(dropRow.ok);
	assert.equal(blockOf(dropRow.page, fid).props, undefined, "a removed row takes its overrides with it");
});

test("P1 gate: unknown pointers and values outside the props schema fail closed (props_invalid)", () => {
	const { page, id } = miniCards();
	const block = blockOf(page, id);
	assert.equal(checkBlockProps({ ...block, props: { "/actions/secondary": "ok" } }, "$.layout.blocks[0]"), null);
	const unknown = checkBlockProps({ ...block, props: { "/nope": "x" } }, "$.layout.blocks[0]");
	assert.equal(unknown?.code, "props_invalid");
	const wrongType = checkBlockProps({ ...block, props: { "/tone": "neon" } }, "$.layout.blocks[0]");
	assert.equal(wrongType?.code, "props_invalid");
	assert.throws(() => parsePageOf({ ...JSON.parse(JSON.stringify(page)), layout: { blocks: [{ ...block, props: { "no-slash": "x" } }] } }));
});

test("P1 carry: variant change drops axis overrides; swap keeps compatible ones and names dropped; proposals keep them", () => {
	const { page, provenance, id } = miniCards();
	const a = inspectorSetField(page, id, "/actions/secondary", "Book a call", NOW);
	assert.ok(a.ok);
	const b = inspectorSetField(a.page, id, "/mediaSide", "start", NOW);
	assert.ok(b.ok, JSON.stringify(b));
	assert.deepEqual(Object.keys(blockOf(b.page, id).props ?? {}).sort(), ["/actions/secondary", "/mediaSide"]);
	const variants = inspectorModel(blockOf(b.page, id));
	assert.ok(variants.ok);
	const other = variants.variants.find((name) => name !== "miniCards")!;
	const sv = inspectorOp({ page: b.page, provenance, revision: 1, now: NOW }, { op: "set_variant", blockId: id, variant: other });
	assert.ok(sv.ok, JSON.stringify(sv));
	assert.deepEqual(blockOf(sv.page, id).props, { "/actions/secondary": "Book a call" }, "the new variant sets its own axes");
	assert.ok(sv.ok && sv.dropped?.includes("/mediaSide"), "the dropped axis override is named");
	// Swap to another item of the kind: /actions/secondary exists on hero-classic, /mediaSide does not.
	const swap = swapCatalogBlock(blockOf(b.page, id), { catalogBlock: "block.hero", variant: "centered" });
	assert.ok(swap.ok, JSON.stringify(swap));
	if (swap.ok) {
		assert.deepEqual(swap.node.props, { "/actions/secondary": "Book a call" });
		assert.ok(swap.dropped.includes("props /mediaSide"), JSON.stringify(swap.dropped));
	}
	// A model rebuild of the same blocks keeps the overrides (Chat / Ask never drop them silently).
	const rebuilt = blockOf(b.page, id);
	const bare = { ...rebuilt };
	delete bare.props;
	const warnings: string[] = [];
	const carried = carryPropsOverrides(b.page.layout.blocks, [bare], warnings);
	assert.deepEqual(carried[0]!.props, rebuilt.props);
	// A model edit_page patch keeps them too.
	const edited = editPage({ page: b.page, provenance, patch: { ops: [{ op: "set", blockId: id, field: "headline", value: "Renamed" }] }, expectedRevision: 1, now: NOW });
	assert.ok(edited.ok, JSON.stringify(edited).slice(0, 300));
	if (edited.ok) assert.deepEqual(blockOf(edited.page, id).props, rebuilt.props);
});

test("P1 export: the Svelte source passes the merged props (overrides included) to the registry block", () => {
	const { page, id } = miniCards();
	const a = inspectorSetField(page, id, "/actions/secondary", "Book a call", NOW);
	assert.ok(a.ok);
	const b = inspectorSetField(a.page, id, "/content/card/title", "Roastery tour", NOW);
	assert.ok(b.ok);
	const source = sveltePackFiles(b.page as never).map((file) => file.content).join("\n");
	assert.match(source, /Book a call/);
	assert.match(source, /Roastery tour/);
});

test("P1 history: inspector results carry op + path; revisions record them; session 1.6.0 accepts them", () => {
	assert.deepEqual([...SESSION_REVISION_OPS], ["set_field", "set_variant", "add", "move", "remove", "insert", "replace", "set_family"]);
	const store = web("lib/inspector/inspector.svelte.ts");
	assert.match(store, /replaceVisiblePage\(result\.page, result\.blockId, commitChange\(steps\.continues\(key\)\), meta, pageProv\)/);
	const pageStore = web("lib/page-store/mock.svelte.ts");
	assert.match(pageStore, /announce\(step\.cause, selectId, step\.cause === "edit" \? meta : undefined\)/);
	assert.match(web("lib/chat-core/session.svelte.ts"), /event\.op \? \{ op: event\.op \}/);
	const { page, provenance, id } = miniCards();
	const moved = inspectorOp({ page, provenance, revision: 1, now: NOW }, { op: "duplicate", blockId: id });
	assert.ok(moved.ok && moved.op === "insert");
});

test("P1 ui: prop fields are editable controls; list rows have add / up / down / remove; en + ru", () => {
	const view = web("app/InspectorFields.svelte");
	assert.match(view, /field\.origin \|\| field\.prop/);
	for (const action of ["row-up", "row-down", "remove-row", "add-row"]) assert.match(view, new RegExp(`data-action="${action}"`));
	assert.match(view, /handlers!\.onlist!\(field\.pointer, "add"\)/);
	assert.match(web("app/InspectorPanel.svelte"), /op: "list_row"/);
	for (const locale of ["en", "ru"]) {
		const messages = JSON.parse(web(`lib/i18n/${locale}.json`)).messages;
		for (const key of ["inspector.prop.axis", "inspector.prop.axisOverridden", "inspector.prop.overridden", "inspector.prop.variant", "inspector.prop.sample", "inspector.prop.unset", "inspector.propsInvalid", "inspector.rowUp", "inspector.rowDown", "inspector.addRow"]) {
			assert.ok(messages[key], `${locale}: ${key}`);
		}
	}
});

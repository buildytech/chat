/**
 * Build inspector (ADR 0034): block identity on the canvas, editor chrome drawn by the chat over the frame (never in the
 * page), the schema-driven field model over `blocks[].props`, and local history. Edits are page operations (page-ops.test.ts).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { InspectorField } from "../../packages/builder-core/src/index.ts";
import { blockSelector, overlayRect, sameRect, topLevelBlockId } from "../../apps/chat-web/src/lib/inspector/geometry.ts";
import { closestAllowed, fieldDomId, hasContent, partitionFields } from "../../apps/chat-web/src/lib/inspector/fields.ts";
import { EditHistory } from "../../apps/chat-web/src/lib/inspector/history.ts";

const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");

test("canvas: a block id selects its block; unknown ids select nothing", () => {
	const blocks = [{ id: "block-nav" }, { id: "block-hero" }];
	assert.equal(topLevelBlockId(blocks, "block-hero"), "block-hero");
	assert.equal(topLevelBlockId(blocks, "nope"), null);
	assert.equal(topLevelBlockId(blocks, null), null);
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

test("inspector fields: dom ids, content first, closest allowed values", () => {
	assert.equal(fieldDomId("block-hero", "/actions/cta"), "insp-block-hero-actions-cta");
	const fields = [
		{ pointer: "/a", name: "a", widget: "text", required: false, value: undefined },
		{ pointer: "/b", name: "b", widget: "text", required: false, value: "x" },
		{ pointer: "/c", name: "c", widget: "text", required: false, value: undefined }
	] satisfies InspectorField[];
	assert.equal(hasContent(fields[1]!), true);
	assert.equal(hasContent(fields[0]!), false);
	const { main, more } = partitionFields(fields);
	assert.deepEqual(main.map((f) => f.name), ["b"]);
	assert.deepEqual(more.map((f) => f.name), ["a", "c"]);
	// A field keeps its group while the block stays selected (the first keystroke into "More" keeps focus).
	const placed = new Map<string, "main" | "more">();
	partitionFields(fields, placed);
	const typed = partitionFields([{ ...fields[0]!, value: "x" }, fields[1]!, fields[2]!], placed);
	assert.deepEqual(typed.more.map((f) => f.name), ["a", "c"], "stays in More after the first character");
	assert.deepEqual(closestAllowed("rockett", ["arrow-right", "rocket", "rows"], 2), ["rocket", "rows"]);
	assert.deepEqual(closestAllowed("ro", ["arrow-right", "rocket", "rows"], 3), ["rocket", "rows", "arrow-right"]);
});

test("inspector store: edits are page operations; no chat proposal per keystroke; undo keys in Ask and Build; frame keys too", () => {
	const store = web("lib/inspector/inspector.svelte.ts");
	assert.match(store, /applyOp\(/);
	assert.match(store, /replaceVisiblePage\(/);
	assert.doesNotMatch(store, /setCandidatePage|sendMessage|applyProposal|inspectorSetField|proposeLayout/);
	assert.doesNotMatch(store, /getChatMode\(\) !== "build"/);
	assert.match(web("app/PreviewPane.svelte"), /doc\.addEventListener\("keydown", inspector\.onKey\)/);
	assert.match(web("app/InspectorPanel.svelte"), /<svelte:window onkeydown=\{inspector\.onKey\} \/>/);
});

test("inspector panel: registry widgets only, no lock or origin chrome (props are the single source)", () => {
	const fields = web("app/InspectorFields.svelte");
	assert.doesNotMatch(fields, /LOCKED_CONTROL|lockHint|inspector\.locked|origin/);
	for (const widget of ["text", "longtext", "icon", "enum", "boolean", "number", "list"]) assert.match(fields, new RegExp(`"${widget}"`), widget);
	assert.match(web("app/InspectorPanel.svelte"), /InspectorFields/);
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

/**
 * ADR 0024 step C: dragging a Blocks feed card into the preview or the Sections list. The drop is the inspector add
 * operation at a top-level slot (every gate, one undo step, no model call); slots above the header or below the
 * footer, and cards the page cannot take, are refused with a reason.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { addSlotCheck, inspectorOp, stockScreenDraft } from "../../packages/builder-core/src/index.ts";
import { insertionSlot } from "../../apps/chat-web/src/lib/feed/sections.ts";

const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");

function started() {
	const draft = stockScreenDraft({ screenId: "screen.site/home" });
	assert.ok(draft.ok);
	return { page: draft.proposal.page, provenance: { screenId: "screen.site/home", scenarioId: null } };
}

test("addSlotCheck: content between the header run and the footer run; header on top, footer at the end", () => {
	const page = [{ kind: "nav" }, { kind: "hero" }, { kind: "features" }, { kind: "footer" }] as const;
	assert.deepEqual([0, 1, 2, 3, 4].map((at) => { const r = addSlotCheck(page, "features", at); return r.ok ? "ok" : r.code; }), ["above_header", "ok", "ok", "ok", "below_footer"]);
	assert.equal(addSlotCheck(page, "nav", 0).ok, true);
	assert.equal((addSlotCheck(page, "nav", 2) as { code: string }).code, "header_top");
	assert.equal(addSlotCheck(page, "footer", 4).ok, true);
	assert.equal((addSlotCheck(page, "footer", 1) as { code: string }).code, "footer_end");
	assert.equal((addSlotCheck(page, "hero", 9) as { code: string }).code, "index_out_of_range");
	assert.equal((addSlotCheck(page, "hero", 1.5) as { code: string }).code, "index_out_of_range");
	assert.equal(addSlotCheck([], "hero", 0).ok, true, "an empty page takes a section at 0");
	assert.equal(addSlotCheck([{ kind: "sidenav" }, { kind: "nav" }, { kind: "hero" }], "metrics", 2).ok, true);
	assert.equal(addSlotCheck([{ kind: "sidenav" }, { kind: "nav" }, { kind: "hero" }], "metrics", 1).ok, false);
});

test("insertion slot and line: gaps between sections, edges for first and last", () => {
	const boxes = [0, 100, 200].map((top) => ({ top, height: 90 }));
	assert.deepEqual(insertionSlot(boxes, 10), { slot: 0, lineY: 0 });
	assert.deepEqual(insertionSlot(boxes, 60), { slot: 1, lineY: 95 });
	assert.deepEqual(insertionSlot(boxes, 260), { slot: 3, lineY: 290 });
	assert.deepEqual(insertionSlot([], 50), { slot: 0, lineY: 0 });
});

test("drop = inspector add at the slot: every gate, base untouched, refused slots change nothing", () => {
	const { page, provenance } = started();
	const ctx = { page, provenance, revision: 1, now: "2026-11-11T00:00:02.000Z" };
	const n = page.layout.blocks.length;
	assert.equal(page.layout.blocks[0]!.kind, "nav");
	assert.equal(page.layout.blocks.at(-1)!.kind, "footer");
	for (const at of [1, Math.floor(n / 2), n - 1]) {
		const done = inspectorOp(ctx, { op: "add", blockId: "", catalogBlock: "block.features", variant: "grid2", at });
		assert.ok(done.ok, JSON.stringify(done));
		assert.equal(done.page.layout.blocks[at]!.id, done.blockId, `lands at slot ${at}`);
		assert.equal(done.page.layout.blocks[at]!.variant, "grid2");
		assert.equal(done.page.layout.blocks.length, n + 1);
	}
	for (const [at, code] of [[0, "above_header"], [n, "below_footer"], [n + 5, "index_out_of_range"]] as const) {
		const refused = inspectorOp(ctx, { op: "add", blockId: "", catalogBlock: "block.features", variant: "grid2", at });
		assert.equal(refused.ok, false);
		assert.equal((refused as { code: string }).code, code);
	}
	const unsupported = inspectorOp(ctx, { op: "add", blockId: "", catalogBlock: "block.about", at: 1 });
	assert.equal((unsupported as { code: string }).code, "not_a_page_block");
	assert.equal(page.layout.blocks.length, n, "the base page is never modified");
});

test("drag UI: host drop layer over the preview iframe, Sections list drop, '+' stays, no model call", () => {
	const pane = web("app/PreviewPane.svelte");
	assert.match(pane, /<DropOverlay doc=\{frameDoc\} scale=\{frameScale\} \/>/);
	const overlay = web("app/DropOverlay.svelte");
	assert.match(overlay, /\{#if feedDrag\.active\}/, "the layer exists only while a card is dragged");
	assert.match(overlay, /class="absolute inset-0 z-20"/);
	assert.match(overlay, /ondrop=\{onDrop\}/);
	assert.match(overlay, /dropRefusal\(/);
	assert.match(overlay, /scrollBy\(/, "the frame scrolls near its edges while dragging");
	const card = web("app/FeedCard.svelte");
	assert.match(card, /draggable=\{item\.type === "block" \? "true" : undefined\}/);
	assert.match(card, /setData\(FEED_DRAG_TYPE, item\.id\)/);
	assert.match(card, /data-action="feed-add"/, "'+' stays the keyboard path");
	const drop = web("lib/feed/drop.svelte.ts");
	assert.match(drop, /inspector\.add\(item\.spec, item\.variant, at\)/);
	assert.match(drop, /addSlotCheck\(page \? blocksOf\(page\) : \[\], check\.kind, at\)/);
	assert.doesNotMatch(drop, /no_page/, "no page yet is not a refusal: the drop starts an empty page");
	const sections = web("app/SectionsList.svelte");
	assert.match(sections, /ondrop=\{onFeedDrop\}/);
	assert.match(sections, /dropAt\(target\.slot\)/);
	const column = web("app/ChatColumn.svelte");
	assert.match(column, /ondragenter=\{\(\) => springOpen\(name\)\}/, "resting a drag on the Sections tab opens it");
	for (const source of [overlay, drop, sections, card]) assert.doesNotMatch(source, /sendMessage|runtime\/v1|runXaiProposal/);
});

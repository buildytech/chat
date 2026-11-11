/**
 * ADR 0024 step B: the Sections tab (reorder by pointer / buttons / keyboard, remove, variant: inspector operations,
 * one undo step each, no model call) and "Start page from this screen" (program assembly, no model call).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	catalogSnapshot,
	screenSections,
	catalogVariantsFor,
	clientProposalGate,
	inspectorOp,
	stockScreenDraft,
	stockSearch
} from "../../packages/builder-core/src/index.ts";
import { dropIndex, stepIndex } from "../../apps/chat-web/src/lib/feed/sections.ts";
import { EditHistory } from "../../apps/chat-web/src/lib/inspector/history.ts";
import type { Page } from "../../packages/page-contract/src/index.ts";

const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");
const ids = (page: Page) => page.layout.blocks.map((node) => node.id);

function startedPage() {
	const draft = stockScreenDraft({ screenId: "screen.site/home" });
	assert.ok(draft.ok, JSON.stringify(draft));
	return { page: draft.proposal.page, provenance: { screenId: "screen.site/home", scenarioId: null } };
}

test("drop index and keyboard step: move semantics, clamped to the list", () => {
	const boxes = [0, 40, 80, 120].map((top) => ({ top, height: 40 }));
	assert.equal(dropIndex(boxes, 10, 2), 0, "above the first middle: first");
	assert.equal(dropIndex(boxes, 70, 0), 1, "dragging down past item 1: lands after it");
	assert.equal(dropIndex(boxes, 500, 0), 3, "below everything: last");
	assert.equal(dropIndex(boxes, 90, 2), 2, "over itself: stays");
	assert.equal(dropIndex([], 10, 0), 0);
	assert.equal(stepIndex(0, -1, 4), null);
	assert.equal(stepIndex(3, 1, 4), null);
	assert.equal(stepIndex(1, 1, 4), 2);
});

test("Start page from this screen: program draft, no model, passes the browser catalog gate", () => {
	const draft = stockScreenDraft({ screenId: "screen.site/home" });
	assert.ok(draft.ok);
	assert.equal(draft.proposal.liveModel, false);
	assert.equal(draft.proposal.source, "local-catalog-assembler");
	assert.ok(draft.proposal.page.layout.blocks.length > 2);
	assert.ok(clientProposalGate(draft.proposal).ok);
	assert.equal(stockScreenDraft({ screenId: "screen.nope/none" }).ok, false);
	// t150u: the feed's `supported` flag is a property of the screen (it has a section the page renders); a screen the
	// full draft cannot assemble starts from its renderable sections (BlocksFeed startFromSections).
	const screens = [1, 2].flatMap((page) => stockSearch({ type: "screen", page, pageSize: 48 }).items);
	assert.equal(screens.length, catalogSnapshot.screens.length);
	for (const item of screens) {
		assert.equal(item.supported, screenSections(item.id).sections.length > 0, item.id);
		if (stockScreenDraft({ screenId: item.id }).ok) assert.ok(item.supported, item.id);
	}
	const session = web("lib/chat-core/session.svelte.ts");
	const body = session.slice(session.indexOf("export async function startPageFromScreen"), session.indexOf("export function applyVariantFromAsk"));
	assert.match(body, /stockScreenDraft\(/);
	assert.match(body, /applyProposal\(\)/);
	assert.doesNotMatch(body, /origin:/, "no proposal origin outside the session schema enum");
	assert.doesNotMatch(body, /runConstructor|runXaiProposal|fetchXaiStatus|sendMessage/, "no model call");
	const card = web("app/FeedCard.svelte");
	assert.match(card, /data-action="feed-start"/);
	assert.match(card, /disabled=\{!item\.supported \|\| starting\}/);
	assert.match(web("app/BlocksFeed.svelte"), /startPageFromScreen\(item\.id\)/);
});

test("Sections ops: move, remove, variant are inspector operations, one history step each, base untouched", () => {
	const { page, provenance } = startedPage();
	const ctx = (p: Page) => ({ page: p, provenance, revision: 1, now: "2026-11-11T00:00:01.000Z" });
	const before = ids(page);
	const history = new EditHistory<Page>();
	const second = before[1]!;
	const moved = inspectorOp(ctx(page), { op: "move", blockId: second, to: 2 });
	assert.ok(moved.ok, JSON.stringify(moved));
	history.record(page, moved.page);
	assert.equal(ids(moved.page)[2], second);
	assert.equal(ids(moved.page).length, before.length);
	const target = moved.page.layout.blocks.find((node) => node.catalogBlock && catalogVariantsFor(node.catalogBlock).length > 1)!;
	const other = catalogVariantsFor(target.catalogBlock!).find((v) => v !== target.variant)!;
	const varied = inspectorOp(ctx(moved.page), { op: "set_variant", blockId: target.id, variant: other });
	assert.ok(varied.ok, JSON.stringify(varied));
	history.record(moved.page, varied.page);
	assert.equal(varied.page.layout.blocks.find((node) => node.id === target.id)!.variant, other);
	const removed = inspectorOp(ctx(varied.page), { op: "remove", blockId: second });
	assert.ok(removed.ok);
	history.record(varied.page, removed.page);
	assert.ok(!ids(removed.page).includes(second));
	assert.deepEqual(ids(page), before, "the base page is never modified");
	// Undo walks back one action at a time, redo forward.
	assert.equal(history.undo(), varied.page);
	assert.equal(history.undo(), moved.page);
	assert.equal(history.redo(), varied.page);
	assert.equal(inspectorOp(ctx(page), { op: "set_variant", blockId: target.id, variant: "nosuch" }).ok, false);
});

test("Sections tab UI: accessible sortable list, every action through inspector.run, no model call", () => {
	assert.match(web("app/ChatColumn.svelte"), /<SectionsList \/>/);
	const ui = web("app/SectionsList.svelte");
	assert.match(ui, /tag="ul"[^>]*aria-label=\{t\("sections\.list"\)\}[^>]*aria-describedby="sections-help"/);
	assert.match(ui, /role="status" aria-live="assertive"/);
	assert.match(ui, /event\.altKey && \(event\.key === "ArrowUp" \|\| event\.key === "ArrowDown"\)/);
	assert.match(ui, /setPointerCapture/);
	assert.match(ui, /data-action="section-up"/);
	assert.match(ui, /data-action="section-down"/);
	assert.match(ui, /data-action="section-remove"/);
	assert.match(ui, /data-action="section-variant"/);
	for (const op of ["move", "remove", "set_variant"]) assert.match(ui, new RegExp(`inspector\\.run\\(\\{ op: "${op}"`));
	assert.match(ui, /selectBlock\(block\.id\)/);
	assert.match(ui, /topLevelBlockId\(sections, getSelectedBlockId\(\)\)/, "a pick in the preview selects its section");
	assert.match(ui, /inspector\.undo\(\)/);
	assert.match(ui, /inspector\.redo\(\)/);
	assert.doesNotMatch(ui, /sendMessage|runtime\/v1|chat-core/, "no model call from the Sections tab");
});

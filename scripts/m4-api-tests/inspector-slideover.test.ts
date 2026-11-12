/**
 * ADR 0024 step D: the inspector as a non-modal slide-over on the preview (opens on a preview or Sections pick, Esc
 * and close button, remembered), and the header / footer position rules for moves as for adds.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inspectorOp, moveSlotCheck, stockScreenDraft } from "../../packages/builder-core/src/index.ts";

const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");
const code = (r: { ok: boolean }) => (r.ok ? "ok" : (r as unknown as { code: string }).code);

test("moveSlotCheck: header stays in the leading run, footer in the trailing run, content between", () => {
	const page = [{ kind: "nav" }, { kind: "hero" }, { kind: "features" }, { kind: "cta" }, { kind: "footer" }] as const;
	assert.equal(code(moveSlotCheck(page, 0, 2)), "header_top");
	assert.equal(code(moveSlotCheck(page, 4, 1)), "footer_end");
	assert.equal(code(moveSlotCheck(page, 1, 0)), "above_header");
	assert.equal(code(moveSlotCheck(page, 3, 4)), "below_footer");
	assert.equal(code(moveSlotCheck(page, 1, 3)), "ok");
	assert.equal(code(moveSlotCheck(page, 3, 1)), "ok");
	assert.equal(code(moveSlotCheck(page, 0, 0)), "ok");
	assert.equal(code(moveSlotCheck(page, 2, 9)), "index_out_of_range");
	assert.equal(code(moveSlotCheck([{ kind: "sidenav" }, { kind: "nav" }, { kind: "overview" }], 1, 0)), "ok", "header run order is free");
});

test("move op applies the rules (Sections buttons, Alt+Arrow, drag and the inspector all run it)", () => {
	const draft = stockScreenDraft({ screenId: "screen.site/home" });
	assert.ok(draft.ok);
	const page = draft.proposal.page;
	const ctx = { page, provenance: { screenId: "screen.site/home", scenarioId: null }, revision: 1, now: "2026-11-11T00:00:03.000Z" };
	const blocks = page.layout.blocks;
	const n = blocks.length;
	const header = blocks[0]!;
	const footer = blocks[n - 1]!;
	assert.equal(header.kind, "nav");
	assert.equal(footer.kind, "footer");
	assert.equal(code(inspectorOp(ctx, { op: "move", blockId: header.id, to: 2 })), "header_top");
	assert.equal(code(inspectorOp(ctx, { op: "move", blockId: footer.id, to: n - 2 })), "footer_end");
	assert.equal(code(inspectorOp(ctx, { op: "move", blockId: blocks[1]!.id, to: 0 })), "above_header");
	assert.equal(code(inspectorOp(ctx, { op: "move", blockId: blocks[n - 2]!.id, to: n - 1 })), "below_footer");
	const ok = inspectorOp(ctx, { op: "move", blockId: blocks[1]!.id, to: 2 });
	assert.ok(ok.ok);
	assert.equal(ok.page.layout.blocks[2]!.id, blocks[1]!.id);
	assert.equal(page.layout.blocks[1]!.id, blocks[1]!.id, "the base page is never modified");
});

test("slide-over: over the preview, non-modal, no backdrop, opens on picks, Esc / close, remembered", () => {
	const workspace = web("app/Workspace.svelte");
	assert.match(workspace, /\{#if inspectorPanel\.open\}\s*<!--[^>]*-->\s*<InspectorSlideOver \/>/);
	assert.match(workspace, /event\.key === "Escape" && !event\.defaultPrevented[\s\S]*inspectorPanel\.close\(\)/);
	assert.doesNotMatch(workspace, /<Sheet|bg-foreground\/40|InspectorColumn/, "no modal sheet, no dimming backdrop, no column");
	const slide = web("app/InspectorSlideOver.svelte");
	assert.match(slide, /tag="aside"/, "a complementary landmark, not a modal dialog");
	assert.match(slide, /aria-labelledby="inspector-slideover-title"/);
	assert.match(slide, /class="absolute inset-y-0 right-0 z-30 flex w-80 max-w-full/, "fixed 320px width: the preview stays visible at 1024");
	assert.match(slide, /data-action="inspector-close" onclick=\{\(\) => inspectorPanel\.close\(\)\}/);
	assert.doesNotMatch(slide, /aria-modal="true"/);
	assert.match(web("app/PreviewBlock.svelte"), /selectBlock\(block\.id\);\s*\/\/[^\n]*\n\s*inspectorPanel\.show\(\);/);
	assert.match(web("app/PreviewBlock.svelte"), /focusInspectorControl\(document, block\.id, pointer\)/, "a picked field is focused: no extra click");
	assert.match(web("app/SectionsList.svelte"), /inspectorPanel\.show\(document\.getElementById\(itemId\(block\.id\)\)\)/);
	const panel = web("lib/inspector/panel.svelte.ts");
	assert.match(panel, /feed\.inspector = true/);
	assert.match(panel, /back\.focus\(\{ preventScroll: true \}\)/, "focus goes back where it was");
	assert.match(web("lib/feed/prefs.ts"), /inspector: rec\.inspector === true/, "open state is remembered");
	assert.match(web("app/CreatorShell.svelte"), /inspectorPanel\.toggle\(\)/, "Ctrl+I toggles it");
});

test("Sections: refused moves and drops say the reason; feed drops show 'Insert at position N'", () => {
	const ui = web("app/SectionsList.svelte");
	assert.match(ui, /moveSlotCheck\(sections, from, to\)/);
	assert.match(ui, /data-slot="sections-move-refusal"/);
	assert.match(ui, /SLOT_CODES\.has\(failed\.code\) \? t\(`dnd\.why\.\$\{failed\.code\}`\)/);
	assert.match(ui, /data-slot="sections-drop-label"/);
	assert.match(ui, /t\("dnd\.insertAt"\)\.replace\("\{position\}", String\(feedTarget\.slot \+ 1\)\)/);
	assert.match(web("app/InspectorPanel.svelte"), /SLOT_CODES\.has\(opIssue\.code\)/);
});

/**
 * The Build UI wiring (ADR 0024, 0034): source-level checks that the chat web app keeps its contracts: drag and drop,
 * the inspector slide-over, the Sections list, the empty start and the Stock cards. Every edit goes through the page
 * operations of builder-core (see page-ops.test.ts); no UI path makes a model call.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { landingTab } from "../../apps/chat-web/src/lib/feed/prefs.ts";

const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");

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
	assert.match(card, /draggable=\{canDrag \? "true" : undefined\}/);
	assert.match(card, /setData\(FEED_DRAG_TYPE, item\.id\)/);
	assert.match(card, /data-action="feed-add"/, "'+' stays the keyboard path");
	const drop = web("lib/feed/drop.svelte.ts");
	assert.match(drop, /inspector\.add\(item\.spec, item\.variant, at\)/);
	assert.match(drop, /inspector\.addScreen\(item\.id, at\)/, "a screen card drops its sections");
	assert.match(drop, /addSlotCheck\(page \? blocksOf\(page\) : \[\], check\.item, at\)/);
	assert.doesNotMatch(drop, /no_page/, "no page yet is not a refusal: the drop starts an empty page");
	const sections = web("app/SectionsList.svelte");
	assert.match(sections, /ondrop=\{onFeedDrop\}/);
	assert.match(sections, /dropAt\(target\.slot\)/);
	const column = web("app/ChatColumn.svelte");
	assert.match(column, /ondragenter=\{\(\) => springOpen\(name\)\}/, "resting a drag on the Sections tab opens it");
	for (const source of [overlay, drop, sections, card]) assert.doesNotMatch(source, /sendMessage|runtime\/v1|runXaiProposal/);
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
	assert.doesNotMatch(ui, /data-action="section-variant"/);
	for (const op of ["move", "remove"]) assert.match(ui, new RegExp(`inspector\\.run\\(\\{ op: "${op}"`));
	assert.match(ui, /selectBlock\(block\.id\)/);
	assert.match(ui, /topLevelBlockId\(sections, getSelectedBlockId\(\)\)/, "a pick in the preview selects its section");
	assert.match(ui, /inspector\.undo\(\)/);
	assert.match(ui, /inspector\.redo\(\)/);
	assert.doesNotMatch(ui, /sendMessage|runtime\/v1|chat-core/, "no model call from the Sections tab");
});

test("Build opens on Blocks: an empty chat always, a remembered tab only when it has something to show", () => {
	for (const remembered of ["blocks", "sections", "chat"] as const) {
		assert.equal(landingTab(remembered, { hasPage: false, hasMessages: false }), "blocks");
	}
	assert.equal(landingTab("sections", { hasPage: false, hasMessages: true }), "blocks");
	assert.equal(landingTab("chat", { hasPage: false, hasMessages: true }), "chat");
	assert.equal(landingTab("sections", { hasPage: true, hasMessages: false }), "sections");
	assert.equal(landingTab("chat", { hasPage: true, hasMessages: true }), "chat");
	const column = web("app/ChatColumn.svelte");
	assert.match(column, /feed\.land\(landingTab\(feed\.savedTab/);
	const feed = web("lib/feed/feed.svelte.ts");
	assert.match(feed, /land\(next: LeftTab\): void/);
});

test("UI: the first '+' or drop starts the page, the preview shows the empty drop zone, no 'No page yet' refusal", () => {
	const inspector = web("lib/inspector/inspector.svelte.ts");
	assert.match(inspector, /!getCurrentPage\(\) && !startEmptyPageInChat\(\)/);
	assert.doesNotMatch(inspector, /There is no page yet\./);
	const session = web("lib/chat-core/session.svelte.ts");
	assert.match(session, /export function startEmptyPageInChat\(screenId: string \| null = null\): boolean/);
	const store = web("lib/page-store/mock.svelte.ts");
	assert.match(store, /export function startEmptyPage\(page: (?:Page|PageV2), provenance: StoredPageProvenance\): boolean/);
	const frame = web("app/PreviewFrame.svelte");
	assert.match(frame, /data-slot="preview-empty-drop"/);
	assert.match(frame, /t\("preview\.emptyDrop"\)/);
	const overlay = web("app/DropOverlay.svelte");
	assert.match(overlay, /data-slot="drop-empty"/);
	for (const lang of ["en", "ru"]) {
		const messages = JSON.parse(web(`lib/i18n/${lang}.json`)).messages as Record<string, string>;
		assert.equal(messages["feed.why.no_page"], undefined, `${lang}: the 'No page yet' refusal is gone`);
		for (const key of ["preview.emptyDrop", "preview.emptyHint", "page.untitled", "feed.why.no_start_screen"]) assert.ok(messages[key], `${lang}: ${key}`);
	}
	assert.equal(JSON.parse(web("lib/i18n/en.json")).messages["preview.emptyDrop"], "Drag a block here or press +");
});

test("cards: the Stock thumbnail is full-bleed (no padding around it) and home Stock screens use the feed card in 2 columns", () => {
	const frame = web("app/StockMediaCard.svelte");
	assert.match(frame, /overflow-hidden rounded border bg-card/, "the card radius clips the media");
	assert.match(frame, /<StockThumb src=\{thumb\} title=\{thumbTitle\} bleed/);
	assert.match(frame, /class="min-w-0 flex-1 gap-1 p-2"/, "only the body is padded (8px)");
	const thumb = web("app/StockThumb.svelte");
	assert.match(thumb, /bleed \? "border-border" : "rounded border border-border"/);
	const feedCard = web("app/FeedCard.svelte");
	assert.match(feedCard, /<StockMediaCard\s+tag="li"/);
	assert.doesNotMatch(feedCard, /p-2", columns === 1/);
	const stock = web("app/StockCard.svelte");
	assert.match(stock, /<StockMediaCard tag="article"/);
	assert.match(stock, /class="truncate font-mono text-xs text-muted-foreground" title=\{screen\.screenId\}/, "the id is one truncated line");
	assert.doesNotMatch(stock, /break-all/);
	const home = web("app/HomeOnboarding.svelte");
	assert.doesNotMatch(home, /data-slot="stock-grid"|selectScenario|attachScreen/);
	const ask = web("app/AskBlockCards.svelte");
	assert.match(ask, /<StockThumb src=\{card\.thumb\} title=\{card\.title\} bleed class="w-full border-b" \/>/);
});

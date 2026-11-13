/**
 * ADR 0024 empty start: Build opens on Blocks, the first "+" or drop on a chat with no page starts an empty page on a
 * default Stock screen and adds the block (no model call, one undo step), and header / footer are optional: a page
 * may start with its Hero, the position rules apply only to a header or footer that is there.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { pageSpecDefIssues, parsePageSpec, type Page } from "../../packages/page-contract/src/index.ts";
import {
	addSlotCheck,
	canAddCatalogBlock,
	editPage,
	EMPTY_PAGE_SCREENS,
	emptyPageScreenFor,
	emptyPageStart,
	inspectorOp,
	moveSlotCheck,
	proposeLayout,
	validateCatalogProvenance
} from "../../packages/builder-core/src/index.ts";
import { landingTab } from "../../apps/chat-web/src/lib/feed/prefs.ts";

const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");
const NOW = "2026-11-11T18:00:00.000Z";
const kinds = (page: Page) => page.layout.blocks.map((node) => node.kind);

/** The page the Blocks feed builds: empty start, Hero first, then Features and CTA with "+" (after the selection). */
export function heroFirstPage() {
	const start = emptyPageStart({ kind: "hero", title: "New page", locale: "en", now: NOW })!;
	const provenance = start.provenance;
	let page = start.page;
	let selected = "";
	for (const [catalogBlock, variant] of [["block.hero", null], ["block.features", "grid2"], ["block.cta", null]] as const) {
		const r = inspectorOp({ page, provenance, revision: 0, now: NOW }, { op: "add", blockId: selected, catalogBlock, variant });
		assert.ok(r.ok, `${catalogBlock}: ${JSON.stringify(r)}`);
		page = r.page;
		selected = r.blockId;
	}
	return { start, page, provenance };
}

test("empty start: an empty page (no sections, no header or footer) on a default Stock screen, schema-valid", () => {
	const start = emptyPageStart({ kind: "hero", title: "New page", now: NOW });
	assert.ok(start);
	assert.equal(start.page.layout.blocks.length, 0);
	assert.equal(start.provenance.screenId, EMPTY_PAGE_SCREENS[0]);
	assert.equal(start.provenance.assembler, "empty-page");
	assert.deepEqual(pageSpecDefIssues(start.provenance, "provenance"), []);
	assert.deepEqual(pageSpecDefIssues({ applied: start.page, appliedProvenance: start.provenance, revision: 0 }, "record"), []);
	assert.ok(validateCatalogProvenance({ page: start.page, screenId: start.provenance.screenId }).ok);
	assert.deepEqual(parsePageSpec(start.page, { draft: true }).layout.blocks, []);
	// The start screen follows the first block's kind; no family has it: no start.
	assert.equal(emptyPageScreenFor("hero")?.screenId, "screen.theme-marketing-landing/home");
	assert.equal(emptyPageScreenFor("menu")?.screenId, "screen.theme-food-grill/home");
	assert.equal(emptyPageScreenFor("dish")?.screenId, "screen.theme-restaurant-house/home");
	assert.equal(emptyPageScreenFor("metrics")?.screenId, "screen.theme-dashboard-console/home");
	assert.equal(emptyPageStart({ kind: "metrics", title: "Console" })!.provenance.scenarioId, "dashboard");
	assert.equal(emptyPageScreenFor("hours"), null);
});

test("no page yet is not a refusal: the feed check names the start screen; an empty page without a screen starts too", () => {
	const hero = canAddCatalogBlock({ page: null, provenance: null }, "block.hero", null);
	assert.ok(hero.ok && hero.startScreenId === "screen.theme-marketing-landing/home");
	const menu = canAddCatalogBlock({ page: null, provenance: null }, "block.menu", null);
	assert.ok(!menu.ok || menu.startScreenId === "screen.theme-food-grill/home", JSON.stringify(menu));
	const bare = { ...emptyPageStart({ title: "x" })!.page };
	assert.ok(canAddCatalogBlock({ page: bare, provenance: null }, "block.hero", null).ok);
	const started = emptyPageStart({ title: "x" })!;
	const onScreen = canAddCatalogBlock({ page: started.page, provenance: started.provenance }, "block.hero", null);
	assert.ok(onScreen.ok && onScreen.startScreenId === undefined, "a started page adds normally");
});

test("a page may start with Hero: hero, features, CTA and no header or footer pass every gate", () => {
	const { page, provenance } = heroFirstPage();
	assert.deepEqual(kinds(page), ["hero", "features", "cta"]);
	assert.ok(validateCatalogProvenance({ page, screenId: provenance.screenId }).ok);
	assert.deepEqual(pageSpecDefIssues({ applied: page, appliedProvenance: provenance, revision: 3 }, "record"), []);
	// Reorder freely: no header or footer, so no position rule applies.
	const moved = inspectorOp({ page, provenance, revision: 3, now: NOW }, { op: "move", blockId: page.layout.blocks[2]!.id, to: 0 });
	assert.ok(moved.ok, JSON.stringify(moved));
	assert.deepEqual(kinds(moved.page), ["cta", "hero", "features"]);
	// Remove everything: back to an empty page, still valid.
	let empty = page;
	for (const node of page.layout.blocks) {
		const r = inspectorOp({ page: empty, provenance, revision: 3, now: NOW }, { op: "remove", blockId: node.id });
		assert.ok(r.ok, JSON.stringify(r));
		empty = r.page;
	}
	assert.equal(empty.layout.blocks.length, 0);
});

test("header and footer are optional; the position rules apply only when they are there", () => {
	const { page, provenance } = heroFirstPage();
	const ctx = { page, provenance, revision: 3, now: NOW };
	const blocks = page.layout.blocks;
	assert.deepEqual(addSlotCheck(blocks, "hero", 0), { ok: true }, "content may go first with no header");
	assert.deepEqual(addSlotCheck(blocks, "cta", 3), { ok: true }, "content may go last with no footer");
	assert.deepEqual(moveSlotCheck(blocks, 0, 2), { ok: true });
	// A header added later goes first, a footer last; elsewhere refused with the reason.
	assert.equal(addSlotCheck(blocks, "nav", 1).ok, false);
	assert.equal(addSlotCheck(blocks, "footer", 1).ok, false);
	const withHeader = inspectorOp(ctx, { op: "add", blockId: "", catalogBlock: "block.navbar", variant: null, at: 0 });
	assert.ok(withHeader.ok, JSON.stringify(withHeader));
	assert.equal(withHeader.page.layout.blocks[0]!.kind, "nav");
	const refused = inspectorOp(ctx, { op: "add", blockId: "", catalogBlock: "block.navbar", variant: null, at: 2 });
	assert.ok(!refused.ok && refused.code === "header_top");
	const header = withHeader.page.layout.blocks[0]!;
	const down = inspectorOp({ ...ctx, page: withHeader.page }, { op: "move", blockId: header.id, to: 2 });
	assert.ok(!down.ok && down.code === "header_top");
	const removed = inspectorOp({ ...ctx, page: withHeader.page }, { op: "remove", blockId: header.id });
	assert.ok(removed.ok, "the header can be removed again");
	assert.deepEqual(kinds(removed.page), ["hero", "features", "cta"]);
});

test("Chat and Ask plans on a headerless page: no header or footer is put back", () => {
	const { page, provenance } = heroFirstPage();
	const follow = proposeLayout({
		brief: "Change the call to action headline to: Order fresh bread today",
		scenarioId: provenance.scenarioId,
		screenId: provenance.screenId,
		currentPage: page,
		currentProvenance: { screenId: provenance.screenId, scenarioId: provenance.scenarioId, missing: [] },
		expectedRevision: 3,
		now: NOW,
		content: { locale: "en", blocks: [{ kind: "cta", title: "Order fresh bread today", copy: { title: "Order fresh bread today" }, items: [] }] }
	} as never);
	assert.ok(follow.ok, JSON.stringify(follow));
	assert.deepEqual(kinds(follow.page), ["hero", "features", "cta"], "a follow-up edit keeps the page headerless");
	// Ask plan ops run through editPage: a move to the top and removing a header both pass on a headerless page.
	const plan = editPage({ page, provenance: { screenId: provenance.screenId, scenarioId: provenance.scenarioId, missing: [] } as never, patch: { ops: [{ op: "move", blockId: page.layout.blocks[2]!.id, to: 0 }] }, expectedRevision: 3, now: NOW });
	assert.ok(plan.ok, JSON.stringify(plan));
	// A new page from a screen may drop its header and footer (content.remove), starting with the Hero.
	const promo = proposeLayout({ brief: "Promo page for a bakery", scenarioId: "landing", screenId: "screen.theme-marketing-landing/home", expectedRevision: 0, now: NOW, content: { locale: "en", blocks: [], remove: ["nav", "footer"] } } as never);
	assert.ok(promo.ok, JSON.stringify(promo));
	assert.equal(promo.page.layout.blocks[0]!.kind, "hero");
	assert.ok(!kinds(promo.page).includes("nav") && !kinds(promo.page).includes("footer"));
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
	assert.match(inspector, /check\.startScreenId && !startEmptyPageInChat\(check\.startScreenId\)/);
	assert.doesNotMatch(inspector, /There is no page yet\./);
	const session = web("lib/chat-core/session.svelte.ts");
	assert.match(session, /export function startEmptyPageInChat\(screenId: string\): boolean/);
	const store = web("lib/page-store/mock.svelte.ts");
	assert.match(store, /export function startEmptyPage\(page: Page, provenance: StoredPageProvenance\): boolean/);
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

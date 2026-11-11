/**
 * ADR 0024 step A: the shared Stock search (stock-search/v1), the Blocks feed add operation (inspector gates, no
 * model call), the feed prefs, and the two-area Build layout (left panel tabs, inspector slide-over).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	canAddCatalogBlock,
	catalogSnapshot,
	inspectorOp,
	proposeLayout,
	STOCK_SEARCH_FORMAT,
	stockSearch
} from "../../packages/builder-core/src/index.ts";
import { FEED_PAGE_SIZE, defaultFeedPrefs, loadFeedPrefs, parseFeedPrefs, saveFeedPrefs } from "../../apps/chat-web/src/lib/feed/prefs.ts";
import { STORAGE_KEYS } from "../../apps/chat-web/src/lib/browser/storage-v1.ts";

const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");

function sitePage() {
	const made = proposeLayout({ brief: "Bakery site", scenarioId: null, screenId: "screen.site/home", expectedRevision: 0, now: "2026-11-11T00:00:00.000Z", content: { locale: "en", blocks: [] } });
	if (!made.ok) throw new Error(made.code);
	return { page: made.page, provenance: { screenId: "screen.site/home", scenarioId: null } };
}

test("stockSearch: one JSON format over every Stock block variant and screen", () => {
	const all = stockSearch({ pageSize: 48 });
	assert.equal(all.format, STOCK_SEARCH_FORMAT);
	const variants = catalogSnapshot.blockIndex.filter((b) => b.available).reduce((n, b) => n + b.variants.length, 0);
	assert.equal(all.total, variants + catalogSnapshot.screens.length);
	assert.deepEqual(Object.fromEntries(all.facets.type.map((f) => [f.value, f.count])), { block: variants, screen: catalogSnapshot.screens.length });
	assert.equal(all.catalog.digest, catalogSnapshot.sourceDigest);
	// JSON in, JSON out: a future REST / MCP / CLI endpoint returns this object as is.
	assert.deepEqual(JSON.parse(JSON.stringify(all)), all);
	const block = all.items.find((item) => item.type === "block")!;
	assert.match(block.url, /^https:\/\/app\.codegen-x\.com\/#\/asset\/block\.[\w.-]+\/[\w-]+$/);
	assert.equal(block.id, `${block.spec}/${block.variant}`);
	// Blocks a page can take (a section renderer) come first.
	assert.ok(all.items.slice(0, 8).every((item) => item.role !== null));
});

test("stockSearch: filters, facet counts that leave their own facet out, fixed page size", () => {
	const hero = stockSearch({ type: "block", role: "hero" });
	assert.ok(hero.total > 0 && hero.items.every((item) => item.role === "hero"));
	assert.ok(hero.facets.role.some((f) => f.value === "features" && f.count > 0), "role is counted without the role filter");
	const spec = stockSearch({ type: "block", spec: "block.features" });
	const variants = catalogSnapshot.blockIndex.find((b) => b.spec === "block.features")!.variants;
	assert.equal(spec.total, variants.length);
	assert.deepEqual(spec.facets.variant.map((f) => f.value), variants);
	const one = stockSearch({ type: "block", spec: "block.features", variant: "grid2" });
	assert.deepEqual(one.items.map((item) => item.id), ["block.features/grid2"]);
	assert.match(String(one.items[0]!.thumb), /^https:\/\/app\.codegen-x\.com\/thumbs\/block\.features--grid2\.webp\?v=[0-9a-f]{8}$/);
	assert.deepEqual(stockSearch({ variant: "grid2" }).query.variant, null, "variant needs a spec");
	const landing = stockSearch({ type: "screen", site: "landing" });
	assert.ok(landing.total > 0 && landing.items.every((item) => item.sites.includes("landing")));
	assert.ok(stockSearch({ type: "block", site: "landing" }).items.every((item) => item.sites.includes("landing")));
	const text = stockSearch({ q: "pricing", type: "block" });
	assert.ok(text.total > 0 && text.items.every((item) => `${item.spec} ${item.title}`.toLowerCase().includes("pricing") || item.variant.toLowerCase().includes("pricing")));
	assert.equal(stockSearch({ type: "block", q: "zzzz-no-such-word" }).total, 0);
	const pages = stockSearch({ type: "block", page: 2, pageSize: FEED_PAGE_SIZE });
	assert.equal(pages.items.length, FEED_PAGE_SIZE);
	assert.equal(pages.page, 2);
	assert.equal(stockSearch({ page: 10_000 }).page, stockSearch({}).pageCount, "page is clamped");
});

test("stockSearch type=screen is the home Stock field (scope = scenario filter)", () => {
	const scoped = stockSearch({ type: "screen", scope: { section: "dashboard" }, pageSize: 48 });
	assert.ok(scoped.total > 0 && scoped.items.every((item) => item.type === "screen"));
	const ids = new Set(catalogSnapshot.screens.filter((s) => s.labels.section.includes("dashboard")).map((s) => s.screenId));
	assert.ok(scoped.items.every((item) => ids.has(item.id)));
	const onboarding = web("lib/browser/onboarding.svelte.ts");
	assert.match(onboarding, /stockSearch\(\{ type: "screen", q: needle, scope: scopeOf\(catalogQuery\(\)\), page, pageSize: 12 \}\)/);
	assert.match(web("lib/feed/feed.svelte.ts"), /stockSearch\(\{ q, \.\.\.filters, page, pageSize: FEED_PAGE_SIZE, boostRoles: family \? familyKinds\(family\) : null \}\)/);
});

test("Blocks feed add: after the selected section or at the end, every gate, no model call", () => {
	const { page, provenance } = sitePage();
	const ctx = { page, provenance, revision: 1, now: "2026-11-11T00:00:01.000Z" };
	const after = inspectorOp(ctx, { op: "add", blockId: "block-hero", catalogBlock: "block.features", variant: "grid2" });
	assert.ok(after.ok, JSON.stringify(after));
	const blocks = after.page.layout.blocks;
	const index = blocks.findIndex((node) => node.id === after.blockId);
	assert.equal(blocks[index - 1]!.id, "block-hero");
	assert.equal(blocks[index]!.catalogBlock, "block.features");
	assert.equal(blocks[index]!.variant, "grid2");
	assert.equal(new Set(blocks.map((node) => node.id)).size, blocks.length, "ids stay unique");
	const end = inspectorOp(ctx, { op: "add", blockId: "", catalogBlock: "block.featureshowcase", variant: null });
	assert.ok(end.ok);
	assert.equal(end.page.layout.blocks.at(-1)!.catalogBlock, "block.featureshowcase");
	assert.equal(page.layout.blocks.length, 5, "the base page is never modified");
	// The reasons the feed shows on a disabled "+".
	// No page yet: the first block starts an empty page on a default Stock screen (ADR 0024 empty start).
	const start = canAddCatalogBlock({ page: null, provenance: null }, "block.hero", null);
	assert.ok(start.ok && start.startScreenId === "screen.theme-marketing-landing/home", JSON.stringify(start));
	const check = (spec: string, variant: string | null = null) => {
		const r = canAddCatalogBlock({ page, provenance }, spec, variant);
		return r.ok ? "ok" : r.code;
	};
	// ADR 0027: the screen family never rejects a block that has a renderer.
	assert.equal(check("block.metrics"), "ok");
	assert.equal(check("block.about"), "not_a_page_block");
	assert.equal(check("block.features", "nosuch"), "unknown_variant");
	assert.equal(canAddCatalogBlock({ page, provenance: null }, "block.hero", null).ok ? "ok" : "no_screen", "no_screen");
	const mixed = inspectorOp(ctx, { op: "add", blockId: "", catalogBlock: "block.metrics" });
	assert.ok(mixed.ok, JSON.stringify(mixed));
	// Every block the feed offers as addable on this page passes the full gate.
	for (let n = 1; n <= stockSearch({ type: "block", pageSize: 48 }).pageCount; n += 1) {
		for (const item of stockSearch({ type: "block", page: n, pageSize: 48 }).items) {
			if (!canAddCatalogBlock({ page, provenance }, item.spec, item.variant).ok) continue;
			const done = inspectorOp(ctx, { op: "add", blockId: "", catalogBlock: item.spec, variant: item.variant });
			assert.ok(done.ok, `${item.id}: ${done.ok ? "" : done.message}`);
		}
	}
});

test("feed prefs: tab and 1 / 2 columns persist; the page size does not depend on the view", () => {
	assert.equal(FEED_PAGE_SIZE, 8);
	assert.deepEqual(defaultFeedPrefs(), { tab: "blocks", columns: 1, inspector: false });
	assert.deepEqual(parseFeedPrefs({ tab: "blocks", columns: 2 }), { tab: "blocks", columns: 2, inspector: false });
	assert.deepEqual(parseFeedPrefs({ tab: "x", columns: 3 }), defaultFeedPrefs());
	const mem = new Map<string, string>();
	const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
	assert.equal(saveFeedPrefs(store, { tab: "sections", columns: 2, inspector: true }), true);
	assert.deepEqual(JSON.parse(mem.get(STORAGE_KEYS.feed)!), { tab: "sections", columns: 2, inspector: true });
	assert.deepEqual(loadFeedPrefs(store), { tab: "sections", columns: 2, inspector: true });
	mem.set(STORAGE_KEYS.feed, "{broken");
	assert.deepEqual(loadFeedPrefs(store), defaultFeedPrefs());
	const feedSource = web("lib/feed/feed.svelte.ts");
	assert.doesNotMatch(feedSource, /columns\s*\*\s*|pageSize: feed\.columns/);
});

test("Build is two areas: left panel tabs (Blocks / Sections / Chat), inspector as a slide-over on the preview", () => {
	const column = web("app/ChatColumn.svelte");
	assert.match(column, /role="tablist"/);
	for (const name of ["blocks", "sections", "chat"]) assert.match(column, new RegExp(`id="left-panel-${name}" role="tabpanel"[^>]*hidden=\\{tab !== "${name}"\\}`));
	assert.match(column, /<BlocksFeed \/>/);
	assert.match(column, /<SectionsList \/>/);
	assert.match(column, /<ChatThread/);
	assert.match(web("lib/creator-layout.svelte.ts"), /const inspectorColumn = \(\) => false;/);
	assert.match(web("app/Workspace.svelte"), /<Group align="stretch" class="relative min-h-0 flex-1 gap-0" data-slot="build-editor"/);
	const card = web("app/FeedCard.svelte");
	assert.match(card, /<StockMediaCard/, "full-bleed Stock thumbnail through the shared card frame");
	assert.match(card, /data-action="feed-add"/);
	assert.match(card, /href=\{item\.url\}/);
	const feedUi = web("app/BlocksFeed.svelte");
	assert.match(feedUi, /inspector\.add\(item\.spec, item\.variant\)/);
	assert.doesNotMatch(feedUi, /sendMessage|runtime\/v1/, "no model call from the feed");
});

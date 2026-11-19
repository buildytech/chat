/**
 * ADR 0024, ADR 0059: the Blocks feed over the catalog (catalogSearch: one card per block variant, drawn as its prototype in
 * the page's skin), the feed add operation (inspector gates, no model call), the feed prefs, and the two-area Build
 * layout (left panel tabs, inspector slide-over).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { applyOp, catalogSearch, checkAdd, checkPageDoc } from "../../packages/builder-core/src/index.ts";
import { defaultFeedPrefs, loadFeedPrefs, parseFeedPrefs, saveFeedPrefs } from "../../apps/chat-web/src/lib/feed/prefs.ts";
import { STORAGE_KEYS } from "../../apps/chat-web/src/lib/browser/storage-v1.ts";
import { studioPage } from "./studio-page.ts";

const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");

test("Blocks feed add: after the selected section or at the end, every gate, no model call; every card is addable", () => {
	const page = studioPage();
	const before = JSON.stringify(page);
	const check = checkAdd("team-simple", "cards3");
	assert.ok(check.ok, JSON.stringify(check));
	const after = applyOp(page, { op: "add", item: check.item, variant: check.variant, at: 1 });
	assert.ok(after.ok, JSON.stringify(after));
	const index = after.page.blocks.findIndex((block) => block.id === after.blockId);
	assert.equal(index, 1);
	assert.equal(after.page.blocks[index]!.variant, "cards3");
	assert.equal(new Set(after.page.blocks.map((block) => block.id)).size, after.page.blocks.length, "ids stay unique");
	const end = applyOp(page, { op: "add", item: "hero-simple", variant: "mediaTop" });
	assert.ok(end.ok && end.page.blocks.at(-1)!.id === end.blockId && checkPageDoc(end.page).ok, "the block is at the end and the page is valid");
	assert.equal(JSON.stringify(page), before, "the base page is never modified");
	for (const card of catalogSearch().items) {
		const addable = checkAdd(card.item, card.variant);
		assert.ok(addable.ok, card.id);
		if (!addable.ok) continue;
		const done = applyOp(page, { op: "add", item: addable.item, variant: addable.variant });
		assert.ok(done.ok, `${card.id}: ${done.ok ? "" : done.message}`);
	}
});

test("feed prefs: tab and 1 / 2 columns persist", () => {
	assert.deepEqual(defaultFeedPrefs(), { tab: "blocks", columns: 2, inspector: false });
	assert.deepEqual(parseFeedPrefs({ columns: 1 }), { tab: "blocks", columns: 1, inspector: false }, "keep an explicit one-column preference");
	assert.equal(loadFeedPrefs(null).columns, 2, "a new browser starts with two columns");
	assert.deepEqual(parseFeedPrefs({ tab: "blocks", columns: 2 }), { tab: "blocks", columns: 2, inspector: false });
	assert.deepEqual(parseFeedPrefs({ tab: "Not a tab!", columns: 3 }), defaultFeedPrefs());
	assert.equal(parseFeedPrefs({ tab: "chat" }).tab, "chat", "a module's tab id is remembered; the feed shows Blocks while that module is off");
	const mem = new Map<string, string>();
	const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
	assert.equal(saveFeedPrefs(store, { tab: "sections", columns: 2, inspector: true }), true);
	assert.deepEqual(JSON.parse(mem.get(STORAGE_KEYS.feed)!), { tab: "sections", columns: 2, inspector: true });
	assert.deepEqual(loadFeedPrefs(store), { tab: "sections", columns: 2, inspector: true });
	mem.set(STORAGE_KEYS.feed, "{broken");
	assert.deepEqual(loadFeedPrefs(store), defaultFeedPrefs());
	assert.match(web("lib/feed/feed.svelte.ts"), /catalogSearch\(\{ q, category \}\)/);
});

test("Build is two areas: left panel tabs (Blocks / Sections, plus the tabs of loaded modules), inspector as a slide-over on the preview", () => {
	const column = web("app/LeftPanel.svelte");
	assert.match(column, /role="tablist"/);
	for (const name of ["blocks", "sections"]) assert.match(column, new RegExp(`id="left-panel-${name}" role="tabpanel"[^>]*hidden=\\{tab !== "${name}"\\}`));
	assert.match(column, /id=\{`left-panel-\$\{item\.id\}`\}[^>]*hidden=\{tab !== item\.id\}/, "a module tab's panel is mounted too, hidden while another tab is open");
	assert.match(column, /moduleTabs\(\)/);
	assert.match(column, /<BlocksFeed \/>/);
	assert.match(column, /<SectionsList \/>/);
	assert.doesNotMatch(column, /ChatThread|modules\/chat/, "the left panel knows no module by name");
	assert.match(web("lib/creator-layout.svelte.ts"), /inspector: false/, "the inspector is a slide-over, never a column (ADR 0024)");
	assert.match(web("app/Workspace.svelte"), /<Group align="stretch" class="relative min-h-0 flex-1 gap-0" data-slot="build-editor"/);
	const card = web("app/FeedCard.svelte");
	assert.match(card, /<PrototypeThumb item=\{item\.item\} variant=\{item\.variant\}/, "the card draws the variant's prototype");
	assert.match(card, /data-action="feed-add"/);
	assert.doesNotMatch(card, /\.webp|thumbs\/|codegen-x/, "no Stock thumbnails");
	const thumb = web("app/PrototypeThumb.svelte");
	assert.match(thumb, /prototypes\/svelte\/blocks\/\*\.svelte/);
	assert.match(thumb, /pageSkinScope\(\)/, "the prototype wears the page's skin");
	assert.match(thumb, /inert/);
	const feedUi = web("app/BlocksFeed.svelte");
	assert.match(feedUi, /inspector\.add\(item\.item, item\.variant\)/);
	assert.doesNotMatch(feedUi, /sendMessage|runtime\/v1/, "no model call from the feed");
});

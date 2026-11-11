/**
 * ADR 0027: the screen family is advisory (t147u / t149u), and Blocks feed availability is a pure function of the
 * item and the page on every result page (t150u). Hard rules only: header first / footer last, a renderer exists,
 * the schemas pass.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compile } from "svelte/compiler";
import { pageSpecDefIssues, type Page } from "../../packages/page-contract/src/index.ts";
import {
	addScreenSections,
	canAddCatalogBlock,
	deriveFamily,
	emptyPageStart,
	familyKinds,
	inspectorOp,
	nextFamilyState,
	screenSections,
	stockSearch,
	validateCatalogProvenance,
	withFamily
} from "../../packages/builder-core/src/index.ts";
import { sveltePackFiles } from "../../apps/chat-web/src/lib/page-store/svelte-code.ts";
import { FEED_PAGE_SIZE } from "../../apps/chat-web/src/lib/feed/prefs.ts";

const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");
const NOW = "2026-11-11T21:00:00.000Z";

/** The feed path: an empty start on the first block's screen, then "+" for each block at the end. */
function build(blocks: Array<[string, string | null]>) {
	const first = canAddCatalogBlock({ page: null, provenance: null }, blocks[0]![0], blocks[0]![1]);
	assert.ok(first.ok && first.startScreenId, JSON.stringify(first));
	const start = emptyPageStart({ screenId: first.startScreenId, title: "Mixed", now: NOW })!;
	let page: Page = start.page;
	let provenance = { ...start.provenance, family: null as ReturnType<typeof deriveFamily> | null, familyPinned: false };
	for (const [catalogBlock, variant] of blocks) {
		const check = canAddCatalogBlock({ page, provenance }, catalogBlock, variant);
		assert.ok(check.ok, `${catalogBlock}: ${JSON.stringify(check)}`);
		const r = inspectorOp({ page, provenance, revision: 0, now: NOW }, { op: "add", blockId: "", catalogBlock, variant });
		assert.ok(r.ok, `${catalogBlock}: ${JSON.stringify(r)}`);
		page = r.page;
		provenance = nextFamilyState(provenance, page.layout.blocks);
	}
	return { page, provenance };
}

function exportBuilds(page: Page) {
	const files = sveltePackFiles(page);
	assert.ok(files.some((file) => file.path.startsWith("src/sections/")));
	for (const file of files) if (file.path.endsWith(".svelte")) assert.ok(compile(file.content, { filename: file.path, generate: "client" }).js.code.length > 0, file.path);
}

test("t147u: Activity first, then CTA (the reported bug) and more: no screen family rejects a block", () => {
	const { page, provenance } = build([["block.activity", null], ["block.cta", null], ["block.hero", null]]);
	assert.deepEqual(page.layout.blocks.map((node) => node.kind), ["activity", "cta", "hero"]);
	assert.ok(validateCatalogProvenance({ page, screenId: provenance.screenId }).ok);
	assert.deepEqual(pageSpecDefIssues(provenance, "provenance"), []);
	exportBuilds(page);
});

test("t147u: hero first, then dashboard blocks; mixed families build and export", () => {
	const { page, provenance } = build([["block.hero", null], ["block.metrics", null], ["block.activity", null], ["block.menuboard", null]]);
	assert.equal(page.layout.blocks.length, 4);
	assert.ok(validateCatalogProvenance({ page, screenId: provenance.screenId }).ok);
	for (const node of page.layout.blocks) assert.ok(node.catalogBlock, `${node.kind} names its catalog block`);
	exportBuilds(page);
});

test("hard rules stay: header first, footer last, no renderer, invented kinds", () => {
	const { page, provenance } = build([["block.hero", null], ["block.footer", null]]);
	const ctx = { page, provenance, revision: 0, now: NOW };
	const below = inspectorOp(ctx, { op: "add", blockId: "", catalogBlock: "block.cta", variant: null, at: 2 });
	assert.equal(below.ok, false, "nothing below the footer");
	assert.equal(canAddCatalogBlock({ page, provenance }, "block.about", null).ok, false, "no page renderer");
	const fake = { ...page, layout: { ...page.layout, blocks: [...page.layout.blocks, { id: "block-x", kind: "cta", title: "x", summary: "x" } as never] } };
	assert.equal(validateCatalogProvenance({ page: fake, screenId: "screen.theme-dashboard-console/home" }).ok, false, "a bare kind outside the family is rejected");
});

test("t149u: the family is derived from the composition (majority -> family, mixed -> generic) and can be pinned", () => {
	assert.equal(deriveFamily([]), "generic");
	assert.equal(deriveFamily([{ kind: "metrics" }, { kind: "activity" }, { kind: "chart" }]), "dashboard");
	assert.equal(deriveFamily([{ kind: "metrics" }, { kind: "hero" }]), "generic", "a tie is mixed");
	assert.equal(deriveFamily([{ kind: "nav" }, { kind: "footer" }]), "generic", "chrome every family has says nothing");
	const auto = { screenId: "screen.theme-marketing-landing/home", scenarioId: "landing", family: null, familyPinned: false };
	const dash = nextFamilyState(auto, [{ kind: "metrics" }, { kind: "activity" }]);
	assert.equal(dash.family, "dashboard");
	assert.equal(dash.screenId, auto.screenId, "the recorded Stock screen stays");
	assert.equal(nextFamilyState(dash, [{ kind: "metrics" }, { kind: "activity" }]), dash, "same family: same object");
	const pinned = withFamily(dash, "restaurant", true);
	assert.equal(nextFamilyState(pinned, [{ kind: "metrics" }]), pinned, "a pin stops auto updates");
	assert.deepEqual(pageSpecDefIssues({ ...pinned, missing: [] }, "provenance"), []);
	// Advisory: the family ranks its kinds first in the feed; nothing is filtered out.
	const kinds = familyKinds("dashboard");
	assert.ok(kinds.includes("metrics") && !kinds.includes("hero"));
	assert.deepEqual(familyKinds("generic"), []);
	const plain = stockSearch({ type: "block", pageSize: 500 });
	const boosted = stockSearch({ type: "block", pageSize: 500, boostRoles: kinds });
	assert.equal(boosted.total, plain.total);
	assert.ok(kinds.includes(boosted.items[0]!.role as never));
});

test("t149u: family change is its own undo step (set_family) with a non-modal label; Sections pins it", () => {
	const store = web("lib/inspector/inspector.svelte.ts");
	assert.match(store, /\{ op: "set_family" \}/);
	assert.match(store, /pinFamily\(family: PageFamily \| null\)/);
	assert.match(store, /type Snapshot = \{ page: Page; provenance: StoredPageProvenance \| null \}/, "undo restores the family with the page");
	assert.match(web("app/ChatColumn.svelte"), /data-slot="family-note"/);
	assert.match(web("app/SectionsList.svelte"), /data-action="family-pin"/);
	for (const lang of ["en", "ru"]) {
		const dict = JSON.parse(web(`lib/i18n/${lang}.json`)) as Record<string, Record<string, string>> | Record<string, string>;
		const flat = JSON.stringify(dict);
		for (const key of ["family.note", "family.auto", "family.dashboard", "family.landing", "family.food-grill", "family.restaurant", "family.generic", "dnd.droppedScreen", "feed.dragScreenHint"]) {
			assert.ok(flat.includes(`"${key}"`), `${lang}: ${key}`);
		}
	}
});

test("t150u: screens on result pages 2 and 3 start a page (Start page) and drop into one (drag)", () => {
	for (const n of [2, 3]) {
		const result = stockSearch({ type: "screen", page: n, pageSize: FEED_PAGE_SIZE });
		assert.equal(result.page, n);
		for (const item of result.items) {
			assert.ok(item.supported, `${item.id} on page ${n}`);
			// Start page from sections on an empty page.
			const start = emptyPageStart({ screenId: item.id, title: "t", now: NOW })!;
			const started = addScreenSections({ page: start.page, provenance: start.provenance, revision: 0, now: NOW }, item.id);
			assert.ok(started.ok, `${item.id}: ${JSON.stringify(started)}`);
			assert.equal(started.added.length + started.skipped.length >= screenSections(item.id).sections.length, true);
			// Drag into an existing page at slot 1.
			const { page, provenance } = build([["block.hero", null], ["block.cta", null]]);
			const dropped = addScreenSections({ page, provenance, revision: 0, now: NOW }, item.id, 1);
			assert.ok(dropped.ok || dropped.code === "nothing_added", `${item.id}: ${JSON.stringify(dropped)}`);
			if (dropped.ok) {
				assert.ok(validateCatalogProvenance({ page: dropped.page, screenId: provenance.screenId }).ok, item.id);
				assert.equal(dropped.page.layout.blocks[0]!.kind === "hero" || dropped.page.layout.blocks[0]!.kind === "nav", true, "the screen's content goes to the slot, chrome to its edge");
			}
		}
	}
});

test("t150u: Blocks feed page 2: '+' and drop work the same as on page 1", () => {
	const { page, provenance } = build([["block.hero", null]]);
	const items = stockSearch({ type: "block", page: 2, pageSize: FEED_PAGE_SIZE }).items;
	assert.equal(items.length, FEED_PAGE_SIZE);
	let added = 0;
	for (const item of items) {
		const check = canAddCatalogBlock({ page, provenance }, item.spec, item.variant);
		if (!check.ok) continue;
		const plus = inspectorOp({ page, provenance, revision: 0, now: NOW }, { op: "add", blockId: "", catalogBlock: item.spec, variant: item.variant });
		const drop = inspectorOp({ page, provenance, revision: 0, now: NOW }, { op: "add", blockId: "", catalogBlock: item.spec, variant: item.variant, at: 1 });
		assert.ok(plus.ok && (drop.ok || check.kind === "nav"), item.id);
		added += 1;
	}
	assert.ok(added > 0, "page 2 has addable blocks");
});

test("t150u: no cached availability: each card computes its own, the drag carries only the item", () => {
	const feed = web("app/BlocksFeed.svelte");
	assert.doesNotMatch(feed, /const checks = \$derived|checks\[item\.id\]/, "no per-result-page check map");
	const card = web("app/FeedCard.svelte");
	assert.match(card, /const check = \$derived\(item\.type === "block" \? inspector\.canAdd\(item\.spec, item\.variant\) : null\)/);
	assert.match(card, /const canDrag = \$derived\(item\.type === "block" \? check\?\.ok === true : item\.supported\)/);
	const drag = web("lib/feed/drag.svelte.ts");
	assert.doesNotMatch(drag, /AddBlockCheck|let check/, "the drag store keeps the item only");
	assert.match(web("lib/feed/drop.svelte.ts"), /const check = inspector\.canAdd\(item\.spec, item\.variant\)/, "drop checks at drop time");
});

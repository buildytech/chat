/**
 * Page operations (ADR 0034): the one set of edits the inspector, the Sections list, the Blocks feed and drag and drop run.
 * Every operation is a write_page patch on the page document, so a hand edit and an agent edit pass the same gate; the base
 * page is never modified, an operation that changes nothing returns the same page, and the slot rules hold (header first,
 * footer last, content between).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	addScreen,
	addSlotCheck,
	applyOp,
	checkPageDoc,
	deriveFamily,
	writePage,
	emptyPage,
	inspectorModel,
	itemInfo,
	moveSlotCheck,
	naturalIndex,
	renderBlock,
	type InspectorField,
	type PageOp
} from "../../packages/builder-core/src/index.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";

const NOW = "2026-11-13T12:00:00.000Z";

function landing(): PageV2 {
	const r = addScreen(emptyPage({ title: "Coffee house", locale: "en", now: NOW }), "screen.theme-marketing-landing/home");
	assert.ok(r.ok, JSON.stringify(r));
	return r.page;
}

const run = (page: PageV2, op: PageOp) => {
	const before = JSON.stringify(page);
	const r = applyOp(page, op);
	assert.equal(JSON.stringify(page), before, "the base page is never modified");
	return r;
};

test("slots: header on top, footer at the end, content between; moves keep the runs", () => {
	const page = landing();
	const items = page.blocks.map((block) => block.item);
	assert.equal(itemInfo(items[0]!)?.edge, "top");
	assert.equal(itemInfo(items.at(-1)!)?.edge, "bottom");
	const last = page.blocks.length - 1;
	assert.equal(addSlotCheck(page.blocks, "feature-grid", 0).ok, false, "a section above the header");
	assert.equal(addSlotCheck(page.blocks, "feature-grid", page.blocks.length).ok, false, "a section below the footer");
	assert.equal(addSlotCheck(page.blocks, "feature-grid", 2).ok, true);
	assert.equal(addSlotCheck(page.blocks, "nav-bar", 3).ok, false, "a header only at the top");
	assert.equal(moveSlotCheck(page.blocks, 1, 0).ok, false, "a section above the header");
	assert.equal(moveSlotCheck(page.blocks, 1, last).ok, false, "a section below the footer");
	assert.equal(moveSlotCheck(page.blocks, 1, 2).ok, true);
	assert.equal(moveSlotCheck(page.blocks, last, 1).ok, false, "the footer stays last");
	assert.equal(naturalIndex(page.blocks, "feature-grid"), last, "a section without a slot lands before the footer");
});

test("set, set_variant, reset, move, duplicate, remove, replace: one write each, gate-valid, one history entry", () => {
	const page = landing();
	const hero = page.blocks[1]!;
	const set = run(page, { op: "set", blockId: hero.id, pointer: "/title", value: "Fresh coffee" });
	assert.ok(set.ok, JSON.stringify(set));
	assert.equal(set.op, "set_field");
	assert.equal(set.path, "/title");
	assert.equal((set.page.blocks[1]!.props as { title: string }).title, "Fresh coffee");
	assert.deepEqual(set.diff.map((d) => [d.change, d.id, d.paths]), [["changed", hero.id, ["/props/title"]]]);
	// unchanged = the same page object: no step, no revision
	const again = applyOp(set.page, { op: "set", blockId: hero.id, pointer: "/title", value: "Fresh coffee" });
	assert.ok(again.ok);
	assert.equal(again.page, set.page);
	// a value the props schema refuses is not written
	const bad = run(page, { op: "set", blockId: hero.id, pointer: "/tone", value: "neon" });
	assert.ok(!bad.ok);
	if (!bad.ok) assert.equal(bad.issues[0]!.code, "props_invalid");
	assert.ok(!run(page, { op: "set", blockId: hero.id, pointer: "/nope/deeper", value: "x" }).ok);

	const variants = itemInfo(hero.item)!.variants;
	const other = variants.find((name) => name !== (hero.variant ?? itemInfo(hero.item)!.defaultVariant))!;
	const varied = run(page, { op: "set_variant", blockId: hero.id, variant: other });
	assert.ok(varied.ok, JSON.stringify(varied));
	assert.equal(varied.page.blocks[1]!.variant, other);
	assert.ok(!run(page, { op: "set_variant", blockId: hero.id, variant: "nosuch" }).ok);

	const moved = run(page, { op: "move", blockId: page.blocks[2]!.id, to: 3 });
	assert.ok(moved.ok, JSON.stringify(moved));
	assert.equal(moved.page.blocks[3]!.id, page.blocks[2]!.id);
	assert.ok(!run(page, { op: "move", blockId: page.blocks[2]!.id, to: 0 }).ok, "above the header");

	const copy = run(page, { op: "duplicate", blockId: page.blocks[2]!.id });
	assert.ok(copy.ok, JSON.stringify(copy));
	assert.equal(copy.page.blocks.length, page.blocks.length + 1);
	assert.equal(new Set(copy.page.blocks.map((b) => b.id)).size, copy.page.blocks.length);
	assert.ok(!run(page, { op: "duplicate", blockId: page.blocks[0]!.id }).ok, "one header per page");

	const removed = run(page, { op: "remove", blockId: page.blocks[2]!.id });
	assert.ok(removed.ok);
	assert.equal(removed.page.blocks.length, page.blocks.length - 1);

	const replaced = run(page, { op: "replace", blockId: page.blocks[2]!.id, item: "dish-showcase" });
	assert.ok(replaced.ok, JSON.stringify(replaced));
	assert.equal(replaced.page.blocks[2]!.item, "dish-showcase");
	assert.ok(checkPageDoc(replaced.page).ok);

	const reset = run(set.page, { op: "reset", blockId: hero.id });
	assert.ok(reset.ok);
	assert.notEqual((reset.page.blocks[1]!.props as { title: string }).title, "Fresh coffee");

	for (const r of [set, varied, moved, copy, removed, replaced, reset]) if (r.ok) assert.ok(checkPageDoc(r.page).ok);
});

test("page fields (title, slug, locale, seo) are operations on the document too", () => {
	const page = landing();
	for (const [field, value] of [["title", "Beans"], ["slug", "beans"], ["locale", "ru"], ["seo.title", "Beans: coffee"], ["seo.description", "Fresh beans, every day."]] as const) {
		const r = run(page, { op: "page", field, value });
		assert.ok(r.ok, `${field}: ${JSON.stringify(r)}`);
	}
	const r = run(page, { op: "page", field: "seo.description", value: "Fresh beans." });
	assert.ok(r.ok);
	assert.equal(r.page.seo?.description, "Fresh beans.");
	assert.ok(!run(page, { op: "page", field: "slug", value: "Not A Slug" }).ok);
});

test("list rows: add (registry row shape), duplicate, up, down, remove", () => {
	let page = landing();
	const features = page.blocks.find((b) => b.item === "feature-grid")!;
	const model = inspectorModel(features);
	assert.ok(model.ok);
	const list = model.fields.find((f) => f.widget === "list")!;
	assert.ok(list.list && list.rows);
	const count = () => ((page.blocks.find((b) => b.id === features.id)!.props as Record<string, unknown[]>)[list.name] ?? []).length;
	const start = count();
	for (const [action, row] of [["add", 0], ["duplicate", 0], ["down", 0], ["up", 1], ["remove", 0]] as const) {
		const r = run(page, { op: "list_row", blockId: features.id, pointer: list.pointer, action, row });
		assert.ok(r.ok, `${action}: ${JSON.stringify(r)}`);
		page = r.page;
		assert.ok(checkPageDoc(page).ok, action);
	}
	assert.equal(count(), start + 1, "add + duplicate - remove");
});

test("a screen dropped on a page adds its sections in one result; a second header or footer is skipped", () => {
	const page = landing();
	const r = run(page, { op: "add", item: "feature-grid", variant: "grid", at: 2 });
	assert.ok(r.ok);
	const screen = addScreen(page, "screen.theme-marketing-landing/teams", 2);
	assert.ok(screen.ok, JSON.stringify(screen));
	if (screen.ok) {
		assert.ok(screen.added.length >= 1);
		assert.ok(checkPageDoc(screen.page).ok);
		assert.equal(screen.page.blocks.filter((b) => itemInfo(b.item)?.edge === "top").length, 1);
		assert.equal(screen.page.blocks.filter((b) => itemInfo(b.item)?.edge === "bottom").length, 1);
	}
	const refused = run(page, { op: "add", item: "feature-grid", variant: "grid", at: 0 });
	assert.ok(!refused.ok);
	if (!refused.ok) assert.equal(refused.code, "above_header");
});

test("the inspector model lists exactly the props of the registry item, with the values the block renders", () => {
	const page = landing();
	for (const block of page.blocks) {
		const model = inspectorModel(block);
		assert.ok(model.ok, block.item);
		if (!model.ok) continue;
		assert.equal(model.item, block.item);
		assert.deepEqual(model.variants, itemInfo(block.item)!.variants);
		const props = renderBlock(block)!.props as Record<string, unknown>;
		const check = (fields: InspectorField[]) => {
			for (const field of fields) {
				assert.ok(!["id", "class", "className"].includes(field.name));
				if (field.pointer.split("/").length === 2) assert.deepEqual(field.value, props[field.name], `${block.item}${field.pointer}`);
				if (field.fields) check(field.fields);
			}
		};
		check(model.fields);
	}
	assert.deepEqual(inspectorModel({ id: "block-x", item: "no-such-item", variant: null, props: {} }), { ok: false, blockId: "block-x", title: "no-such-item", reason: "not_in_registry" });
});

test("header and footer are optional; the position rules apply only when they are there; the family never rejects a block", () => {
	const start = writePage(emptyPage({ title: "Spring promo", locale: "en", now: NOW }), { page: { version: 2, title: "Spring promo", slug: "spring", locale: "en", blocks: [{ item: "hero-classic", variant: "centered" }, { item: "feature-grid", variant: "grid2" }, { item: "cta-band", variant: "band" }] } }, { now: NOW });
	assert.ok(start.ok, JSON.stringify(!start.ok && start.issues));
	if (!start.ok) return;
	assert.equal(start.page.blocks.length, 3);
	// a header added later goes to the top, a footer to the end
	const withHeader = applyOp(start.page, { op: "add", item: "nav-bar", variant: "inline" });
	assert.ok(withHeader.ok && withHeader.page.blocks[0]!.item === "nav-bar", JSON.stringify(withHeader));
	const withFooter = applyOp(start.page, { op: "add", item: "sitemap-footer", variant: "columns" });
	assert.ok(withFooter.ok && withFooter.page.blocks.at(-1)!.item === "sitemap-footer");
	// a page of landing and dashboard blocks is one page: the family is a feed hint, never a rule
	const mixed = applyOp(start.page, { op: "add", item: "stats-band", variant: "plain4" });
	assert.ok(mixed.ok, JSON.stringify(mixed));
	if (mixed.ok) assert.ok(typeof deriveFamily(mixed.page.blocks) === "string");
	// an empty page is a page: nothing to render, nothing to refuse
	assert.equal(checkPageDoc(emptyPage({ title: "Empty", now: NOW })).ok, true);
});

/**
 * Page operations (ADR 0034): the one set of edits the inspector, the Sections list, the Blocks feed and drag and drop run.
 * Every operation is a write_page patch on the page document, so a hand edit and an agent edit pass the same gate; the base
 * page is never modified, an operation that changes nothing returns the same page, and any block may stand at any slot.
 * The catalog is the simple line (ADR 0059): hero-simple and team-simple.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	addSlotCheck,
	applyOp,
	checkAdd,
	checkPageDoc,
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

const NOW = "2026-11-19T12:00:00.000Z";

const run = (page: PageV2, op: PageOp) => {
	const before = JSON.stringify(page);
	const r = applyOp(page, op);
	assert.equal(JSON.stringify(page), before, "the base page is never modified");
	return r;
};

/** A studio page: hero, team, hero again (the two catalog blocks, one of them twice). */
function studio(): PageV2 {
	let page = emptyPage({ title: "Studio", locale: "en", now: NOW });
	for (const [item, variant] of [["hero-simple", "mediaEnd"], ["team-simple", "cols3"], ["hero-simple", "mediaTop"]] as const) {
		const r = applyOp(page, { op: "add", item, variant });
		assert.ok(r.ok, JSON.stringify(r));
		page = r.page;
	}
	return page;
}

test("the feed's add check: catalog blocks and their variants only", () => {
	assert.deepEqual(checkAdd("hero-simple", null), { ok: true, item: "hero-simple", variant: "mediaEnd" });
	assert.deepEqual(checkAdd("team-simple", "cards3"), { ok: true, item: "team-simple", variant: "cards3" });
	const unknown = checkAdd("feature-grid", null);
	assert.ok(!unknown.ok && unknown.code === "unknown_item");
	const variant = checkAdd("hero-simple", "nosuch");
	assert.ok(!variant.ok && variant.code === "unknown_variant");
});

test("slots: only the slot's existence is checked; an add without a slot lands at the end", () => {
	const page = studio();
	const last = page.blocks.length - 1;
	assert.equal(addSlotCheck(page.blocks, 0).ok, true);
	assert.equal(addSlotCheck(page.blocks, page.blocks.length).ok, true);
	const out = addSlotCheck(page.blocks, page.blocks.length + 1);
	assert.ok(!out.ok && out.code === "index_out_of_range");
	assert.equal(moveSlotCheck(page.blocks, 1, 0).ok, true);
	assert.equal(moveSlotCheck(page.blocks, last, 0).ok, true);
	assert.equal(moveSlotCheck(page.blocks, 0, last + 1).ok, false);
	assert.equal(naturalIndex(page.blocks), page.blocks.length);
	const bad = run(page, { op: "add", item: "team-simple", variant: "cols2", at: page.blocks.length + 1 });
	assert.ok(!bad.ok && bad.code === "index_out_of_range");
});

test("set, set_variant, reset, move, duplicate, remove, replace: one write each, gate-valid", () => {
	const page = studio();
	const hero = page.blocks[0]!;
	const set = run(page, { op: "set", blockId: hero.id, pointer: "/title", value: "Quiet Rooms Studio" });
	assert.ok(set.ok, JSON.stringify(set));
	assert.equal(set.op, "set_field");
	assert.equal(set.path, "/title");
	assert.equal((set.page.blocks[0]!.props as { title: string }).title, "Quiet Rooms Studio");
	assert.deepEqual(set.diff.map((d) => [d.change, d.id, d.paths]), [["changed", hero.id, ["/props/title"]]]);
	// unchanged = the same page object: no step, no revision
	const again = applyOp(set.page, { op: "set", blockId: hero.id, pointer: "/title", value: "Quiet Rooms Studio" });
	assert.ok(again.ok);
	assert.equal(again.page, set.page);
	// a value the props schema refuses is not written
	const bad = run(page, { op: "set", blockId: hero.id, pointer: "/padding", value: "neon" });
	assert.ok(!bad.ok);
	if (!bad.ok) assert.equal(bad.issues[0]!.code, "props_invalid");
	assert.ok(!run(page, { op: "set", blockId: hero.id, pointer: "/nope/deeper", value: "x" }).ok);

	const varied = run(page, { op: "set_variant", blockId: hero.id, variant: "mediaStart" });
	assert.ok(varied.ok, JSON.stringify(varied));
	assert.equal(varied.page.blocks[0]!.variant, "mediaStart");
	assert.ok(!run(page, { op: "set_variant", blockId: hero.id, variant: "nosuch" }).ok);

	const moved = run(page, { op: "move", blockId: page.blocks[2]!.id, to: 0 });
	assert.ok(moved.ok, JSON.stringify(moved));
	assert.equal(moved.page.blocks[0]!.id, page.blocks[2]!.id);

	const copy = run(page, { op: "duplicate", blockId: page.blocks[1]!.id });
	assert.ok(copy.ok, JSON.stringify(copy));
	assert.equal(copy.page.blocks.length, page.blocks.length + 1);
	assert.equal(new Set(copy.page.blocks.map((b) => b.id)).size, copy.page.blocks.length);

	const removed = run(page, { op: "remove", blockId: page.blocks[1]!.id });
	assert.ok(removed.ok);
	assert.equal(removed.page.blocks.length, page.blocks.length - 1);

	const replaced = run(page, { op: "replace", blockId: page.blocks[2]!.id, item: "team-simple" });
	assert.ok(replaced.ok, JSON.stringify(replaced));
	assert.equal(replaced.page.blocks[2]!.item, "team-simple");

	const reset = run(set.page, { op: "reset", blockId: hero.id });
	assert.ok(reset.ok);
	assert.notEqual((reset.page.blocks[0]!.props as { title: string }).title, "Quiet Rooms Studio");

	for (const r of [set, varied, moved, copy, removed, replaced, reset]) if (r.ok) assert.ok(checkPageDoc(r.page).ok);
});

test("page fields (title, slug, locale, seo) are operations on the document too", () => {
	const page = studio();
	for (const [field, value] of [["title", "Rooms"], ["slug", "rooms"], ["locale", "ru"], ["seo.title", "Rooms: a studio"], ["seo.description", "Interiors, quietly."]] as const) {
		const r = run(page, { op: "page", field, value });
		assert.ok(r.ok, `${field}: ${JSON.stringify(r)}`);
	}
	const r = run(page, { op: "page", field: "seo.description", value: "Interiors." });
	assert.ok(r.ok);
	assert.equal(r.page.seo?.description, "Interiors.");
	assert.ok(!run(page, { op: "page", field: "slug", value: "Not A Slug" }).ok);
});

test("list rows (team members): add, duplicate, down, up, remove", () => {
	let page = studio();
	const team = page.blocks.find((b) => b.item === "team-simple")!;
	const model = inspectorModel(team);
	assert.ok(model.ok);
	if (!model.ok) return;
	const list = model.fields.find((f) => f.widget === "list")!;
	assert.equal(list.pointer, "/members");
	const count = () => ((page.blocks.find((b) => b.id === team.id)!.props as Record<string, unknown[]>).members ?? []).length;
	const start = count();
	for (const [action, row] of [["add", 0], ["duplicate", 0], ["down", 0], ["up", 1], ["remove", 0]] as const) {
		const r = run(page, { op: "list_row", blockId: team.id, pointer: list.pointer, action, row });
		assert.ok(r.ok, `${action}: ${JSON.stringify(r)}`);
		page = r.page;
		assert.ok(checkPageDoc(page).ok, action);
	}
	assert.equal(count(), start + 1, "add + duplicate - remove");
});

test("the inspector model lists exactly the props of the registry item, with the values the block renders", () => {
	const page = studio();
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

test("a whole-document write of the two blocks passes, an empty page is a page, an unknown item is refused", () => {
	const start = writePage(emptyPage({ title: "Studio", locale: "en", now: NOW }), { page: { version: 2, title: "Studio", slug: "studio", locale: "en", blocks: [{ item: "hero-simple", variant: "mediaTop" }, { item: "team-simple", variant: "cards3" }] } }, { now: NOW });
	assert.ok(start.ok, JSON.stringify(!start.ok && start.issues));
	if (start.ok) assert.deepEqual(start.page.blocks.map((b) => `${b.item}/${b.variant}`), ["hero-simple/mediaTop", "team-simple/cards3"]);
	assert.equal(checkPageDoc(emptyPage({ title: "Empty", now: NOW })).ok, true);
	const unknown = writePage(emptyPage({ title: "Studio", now: NOW }), { page: { version: 2, title: "Studio", slug: "studio", locale: "en", blocks: [{ item: "feature-grid", variant: "grid" }] } }, { now: NOW });
	assert.ok(!unknown.ok);
});

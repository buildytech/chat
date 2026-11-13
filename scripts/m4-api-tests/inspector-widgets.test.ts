/**
 * Inspector widgets beyond text (ADR 0036): typed enums, optional objects and lists that are absent, lists of plain values,
 * free-form maps. Each one is a page operation on the props, so the same gate answers a hand edit and an agent patch.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
	applyOp,
	coerceEnumValue,
	emptyPage,
	inspectorModel,
	inspectorValue,
	mapKeyIssue,
	PAGE_KEY_PATTERN,
	pointerKey,
	writePage,
	type InspectorField,
	type PageOp
} from "../../packages/builder-core/src/index.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";

const NOW = "2026-11-13T12:00:00.000Z";

function withBlock(item: string, variant?: string): { page: PageV2; id: string } {
	const r = writePage(emptyPage({ title: "t", now: NOW }), { patch: [{ op: "add", path: "/blocks/-", value: { item, ...(variant ? { variant } : {}) } }] }, { now: NOW });
	assert.ok(r.ok, JSON.stringify(r));
	return { page: r.page, id: r.page.blocks[0]!.id };
}

const fieldOf = (page: PageV2, name: string): InspectorField => {
	const model = inspectorModel(page.blocks[0]!);
	assert.ok(model.ok);
	const field = model.fields.find((f) => f.name === name);
	assert.ok(field, `${name} is a field`);
	return field;
};

test("typed enum: `level` is 1 | 2, the widget carries typed values and the op layer coerces text", () => {
	const { page, id } = withBlock("hero-classic");
	const level = fieldOf(page, "level");
	assert.equal(level.widget, "enum");
	assert.deepEqual(level.options, ["1", "2"], "the select shows readable text");
	assert.deepEqual(level.optionValues, [1, 2], "an edit writes the schema's type");
	assert.equal(inspectorValue(level, "2"), 2);
	assert.equal(inspectorValue(level, ""), undefined);
	// the widget path: typed value
	const typed = applyOp(page, { op: "set", blockId: id, pointer: "/level", value: inspectorValue(level, "2") ?? undefined });
	assert.ok(typed.ok, JSON.stringify(typed));
	assert.equal(typed.page.blocks[0]!.props?.level, 2);
	// the agent / form path: the same value as text is coerced, a non-member is rejected with the gate's message
	const text = applyOp(page, { op: "set", blockId: id, pointer: "/level", value: "1" });
	assert.ok(text.ok, JSON.stringify(text));
	assert.equal(text.page.blocks[0]!.props?.level, 1);
	const bad = applyOp(page, { op: "set", blockId: id, pointer: "/level", value: "3" });
	assert.ok(!bad.ok);
	assert.equal(bad.code, "props_invalid");
});

test("coerceEnumValue touches nothing but non-string enum members", () => {
	assert.equal(coerceEnumValue("hero-classic", "/level", "2"), 2);
	assert.equal(coerceEnumValue("hero-classic", "/level", 2), 2);
	assert.equal(coerceEnumValue("hero-classic", "/level", "x"), "x");
	assert.equal(coerceEnumValue("hero-classic", "/title", "2"), "2", "a text prop keeps its text");
	assert.equal(coerceEnumValue("hero-classic", "/nope", "2"), "2");
});

const propsOf = (page: PageV2) => (page.blocks[0]!.props ?? {}) as Record<string, unknown>;

test("absent optional object: an edit under it creates the object with just that path; the write fills what it requires", () => {
	const { page, id } = withBlock("cta-band");
	assert.equal(propsOf(page).quote, undefined, "quote is optional and absent");
	const r = applyOp(page, { op: "set", blockId: id, pointer: "/quote/text", value: "Best decision we made" });
	assert.ok(r.ok, JSON.stringify(r));
	const quote = propsOf(r.page).quote as Record<string, unknown>;
	assert.equal(quote.text, "Best decision we made");
	assert.equal(quote.by, undefined, "an optional sibling is not invented");
	// clearing the only value takes the object away again, never `{}` or an invalid object
	const cleared = applyOp(r.page, { op: "set", blockId: id, pointer: "/quote/text", value: undefined });
	assert.ok(cleared.ok, JSON.stringify(cleared));
	assert.equal(propsOf(cleared.page).quote, undefined);
	// a path the schema does not have is still refused
	const nope = applyOp(page, { op: "set", blockId: id, pointer: "/nowhere/text", value: "x" });
	assert.ok(!nope.ok);
	assert.equal(nope.code, "path_not_found");
});

test("absent optional list: `add` creates it (and the optional objects above it); removing the last row leaves it absent", () => {
	const { page, id } = withBlock("hero-classic");
	assert.equal(propsOf(page).topics, undefined);
	const a = applyOp(page, { op: "list_row", blockId: id, pointer: "/topics", action: "add" });
	assert.ok(a.ok, JSON.stringify(a));
	assert.equal((propsOf(a.page).topics as unknown[]).length, 1);
	const gone = applyOp(a.page, { op: "list_row", blockId: id, pointer: "/topics", action: "remove", row: 0 });
	assert.ok(gone.ok, JSON.stringify(gone));
	assert.equal(propsOf(gone.page).topics, undefined, "an optional list with no rows is absent");
	// the other actions have no row to act on
	const up = applyOp(page, { op: "list_row", blockId: id, pointer: "/topics", action: "up", row: 0 });
	assert.ok(!up.ok);
	assert.equal(up.code, "not_a_list");
});

test("a list inside an absent optional object: `add` creates both", () => {
	const { page, id } = withBlock("faq-list");
	const r = applyOp(page, { op: "list_row", blockId: id, pointer: "/filter/tabs", action: "add" });
	assert.ok(r.ok, JSON.stringify(r));
	const filter = propsOf(r.page).filter as Record<string, unknown>;
	assert.equal((filter.tabs as unknown[]).length, 1);
	assert.ok(filter.mode, "required siblings of the created object are filled");
});

test("trusted markup (`{ __html }`) is not authorable: the Inspector shows it read-only, never as an object that the contract refuses", () => {
	const { page, id } = withBlock("rich-text");
	assert.equal(fieldOf(page, "content").widget, "other");
	const aside = fieldOf(page, "aside");
	assert.equal(aside.widget, "object");
	assert.equal(aside.fields?.find((f) => f.name === "content")?.widget, "other");
	assert.equal(aside.fields?.find((f) => f.name === "title")?.widget, "text");
	// the plain fields beside it still edit
	const r = applyOp(page, { op: "set", blockId: id, pointer: "/aside/title", value: "Note" });
	assert.ok(r.ok, JSON.stringify(r));
});

test("list of plain values (plan features): add, edit, move, remove; at most 24 entries", () => {
	let { page, id } = withBlock("pricing-card");
	const plan = fieldOf(page, "plan");
	assert.equal(plan.widget, "object");
	const features = plan.fields!.find((f) => f.name === "features")!;
	assert.equal(features.widget, "values", "a list of strings is an editable list, not a read-only field");
	assert.equal(features.list?.max, 24);
	const entries = () => ((propsOf(page).plan as Record<string, unknown>).features ?? []) as unknown[];
	const start = entries().length;
	for (const action of ["add", "add"] as const) {
		const r = applyOp(page, { op: "list_row", blockId: id, pointer: "/plan/features", action });
		assert.ok(r.ok, JSON.stringify(r));
		page = r.page;
	}
	assert.equal(entries().length, start + 2);
	const last = start + 1;
	const edit = applyOp(page, { op: "set", blockId: id, pointer: `/plan/features/${last}`, value: "Free shipping" });
	assert.ok(edit.ok, JSON.stringify(edit));
	page = edit.page;
	const up = applyOp(page, { op: "list_row", blockId: id, pointer: "/plan/features", action: "up", row: last });
	assert.ok(up.ok, JSON.stringify(up));
	page = up.page;
	assert.equal(entries()[last - 1], "Free shipping");
	const model = inspectorModel(page.blocks[0]!);
	assert.ok(model.ok);
	const shown = (model.fields.find((f) => f.name === "plan")!.fields!.find((f) => f.name === "features")!).items!;
	assert.equal(shown.length, start + 2);
	assert.equal(shown[last - 1]!.pointer, `/plan/features/${last - 1}`);
	assert.equal(shown[last - 1]!.value, "Free shipping");
	assert.equal(shown[0]!.widget, "text");
	const rm = applyOp(page, { op: "list_row", blockId: id, pointer: "/plan/features", action: "remove", row: last - 1 });
	assert.ok(rm.ok, JSON.stringify(rm));
	page = rm.page;
	assert.ok(!entries().includes("Free shipping"));
	// the cap
	while (entries().length < 24) {
		const r = applyOp(page, { op: "list_row", blockId: id, pointer: "/plan/features", action: "add" });
		assert.ok(r.ok, JSON.stringify(r));
		page = r.page;
	}
	const over = applyOp(page, { op: "list_row", blockId: id, pointer: "/plan/features", action: "add" });
	assert.ok(!over.ok);
	assert.equal(over.code, "max_rows");
});

test("a list of plain values inside list rows (plans[].features) edits through the row pointer", () => {
	let { page, id } = withBlock("pricing-tiers");
	const r = applyOp(page, { op: "list_row", blockId: id, pointer: "/plans", action: "add" });
	assert.ok(r.ok, JSON.stringify(r));
	page = r.page;
	const a = applyOp(page, { op: "list_row", blockId: id, pointer: "/plans/0/features", action: "add" });
	assert.ok(a.ok, JSON.stringify(a));
	const model = inspectorModel(a.page.blocks[0]!);
	assert.ok(model.ok);
	const plans = model.fields.find((f) => f.name === "plans")!;
	const features = plans.rows![0]!.fields.find((f) => f.name === "features")!;
	assert.equal(features.widget, "values");
	assert.equal(features.items!.length >= 1, true);
});

const source = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");

test("widget UI: compact, icons from the shell set, text-xs, en and ru words for every new key", () => {
	const fields = source("app/InspectorFields.svelte");
	assert.match(fields, /from "\$lib\/shell-icons"/);
	assert.doesNotMatch(fields, /lucide|text-\[11px\]|\sstyle=/);
	assert.match(fields, /widget === "values"/);
	for (const action of ["item-up", "item-down", "remove-item", "add-item", "remove-entry", "add-entry"]) assert.match(fields, new RegExp(`data-action="${action}"`));
	const en = JSON.parse(source("lib/i18n/en.json")) as Record<string, Record<string, string>> | Record<string, string>;
	const ru = JSON.parse(source("lib/i18n/ru.json")) as Record<string, Record<string, string>> | Record<string, string>;
	const flat = (o: unknown): Record<string, string> => {
		const out: Record<string, string> = {};
		const walk = (v: unknown) => {
			if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) typeof x === "string" ? (out[k] = x) : walk(x);
		};
		walk(o);
		return out;
	};
	const used = new Set([...fields.matchAll(/t\("(inspector\.[A-Za-z]+)"\)/g)].map((m) => m[1]!));
	assert.ok(used.size > 10);
	for (const key of used) {
		assert.ok(flat(en)[key], `en has ${key}`);
		assert.ok(flat(ru)[key], `ru has ${key}`);
	}
});

test("free-form map (product badges): add, edit, rename, remove; keys are checked", () => {
	let { page, id } = withBlock("product-grid");
	const badges = fieldOf(page, "badges");
	assert.equal(badges.widget, "map", "a map of strings is an editable map, not a read-only field");
	const map = () => (propsOf(page).badges ?? {}) as Record<string, unknown>;
	const run = (op: Omit<Extract<PageOp, { op: "map_entry" }>, "op" | "blockId">) => {
		const r = applyOp(page, { op: "map_entry", blockId: id, ...op });
		return r;
	};
	assert.deepEqual(map(), {}, "badges is required and starts empty");
	let r = run({ pointer: "/badges", action: "add" });
	assert.ok(r.ok, JSON.stringify(r));
	page = r.page;
	assert.deepEqual(Object.keys(map()), ["key1"], "the first entry gets a key a page may write");
	r = run({ pointer: "/badges", action: "add", key: "p2" });
	assert.ok(r.ok, JSON.stringify(r));
	page = r.page;
	// edit the value of an entry: the same set as any prop, at the entry's pointer
	const edit = applyOp(page, { op: "set", blockId: id, pointer: "/badges/p2", value: "Sale" });
	assert.ok(edit.ok, JSON.stringify(edit));
	page = edit.page;
	assert.equal(map().p2, "Sale");
	// the model lists the entries in order with their value fields
	const model = fieldOf(page, "badges");
	assert.deepEqual(model.entries!.map((e) => e.key), ["key1", "p2"]);
	assert.equal(model.entries![1]!.field.pointer, "/badges/p2");
	assert.equal(model.entries![1]!.field.value, "Sale");
	// rename keeps the value and the order
	r = run({ pointer: "/badges", action: "rename", key: "key1", to: "p1" });
	assert.ok(r.ok, JSON.stringify(r));
	page = r.page;
	assert.deepEqual(Object.keys(map()), ["p1", "p2"]);
	// the key rules: not empty, unique, a key a page may write
	for (const [to, code] of [["", "empty_key"], ["p2", "duplicate_key"], ["has space", "bad_key"], ["1st", "bad_key"], ["a-b", "bad_key"], ["__proto__", "bad_key"]] as const) {
		const bad = run({ pointer: "/badges", action: "rename", key: "p1", to });
		assert.ok(!bad.ok, `rename to "${to}" is refused`);
		assert.equal(bad.code, code, to);
	}
	assert.equal(run({ pointer: "/badges", action: "add", key: "p2" }).ok, false);
	assert.equal(run({ pointer: "/badges", action: "remove", key: "zzz" }).ok, false);
	// remove: a required map stays, empty
	for (const key of ["p1", "p2"]) {
		r = run({ pointer: "/badges", action: "remove", key });
		assert.ok(r.ok, JSON.stringify(r));
		page = r.page;
	}
	assert.deepEqual(propsOf(page).badges, {});
	assert.equal(run({ pointer: "/badges", action: "remove", key: "p1" }).ok, false);
	assert.equal(run({ pointer: "/title", action: "add" }).ok, false, "a text prop is not a map");
});

test("map keys: the contract's own pattern, and a pointer-safe path for any key", () => {
	const schema = JSON.parse(readFileSync(new URL("../../packages/page-contract/schema/page-spec-v2.schema.json", import.meta.url), "utf8")) as { $defs: { props?: { propertyNames: { pattern: string } } } };
	assert.equal(PAGE_KEY_PATTERN, schema.$defs.props!.propertyNames.pattern, "the Inspector checks the very pattern the page schema enforces");
	assert.equal(mapKeyIssue("sku_1", []), null);
	assert.equal(mapKeyIssue("sku_1", ["sku_1"]), "duplicate_key");
	assert.equal(mapKeyIssue("abc", [], "^x"), "bad_key", "the item schema's own pattern applies too");
	assert.equal(pointerKey("a/b~c"), "a~1b~0c");
});

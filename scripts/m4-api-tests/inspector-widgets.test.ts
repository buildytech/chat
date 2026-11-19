/**
 * Inspector widgets beyond text (ADR 0036) on the catalog blocks (ADR 0059): typed enums, lists of records, map keys. Each one is a page operation on the props, so the same gate answers a hand edit and an agent patch.
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

test("typed enum: `level` is 1 | 2 | 3, the widget carries typed values and the op layer coerces text", () => {
	const { page, id } = withBlock("hero-simple");
	const level = fieldOf(page, "level");
	assert.equal(level.widget, "enum");
	assert.deepEqual(level.options, ["1", "2", "3"], "the select shows readable text");
	assert.deepEqual(level.optionValues, [1, 2, 3], "an edit writes the schema's type");
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
	const bad = applyOp(page, { op: "set", blockId: id, pointer: "/level", value: "4" });
	assert.ok(!bad.ok);
	assert.equal(bad.code, "props_invalid");
});

test("coerceEnumValue touches nothing but non-string enum members", () => {
	assert.equal(coerceEnumValue("hero-simple", "/level", "2"), 2);
	assert.equal(coerceEnumValue("hero-simple", "/level", 2), 2);
	assert.equal(coerceEnumValue("hero-simple", "/level", "x"), "x");
	assert.equal(coerceEnumValue("hero-simple", "/title", "2"), "2", "a text prop keeps its text");
	assert.equal(coerceEnumValue("hero-simple", "/nope", "2"), "2");
});

const propsOf = (page: PageV2) => (page.blocks[0]!.props ?? {}) as Record<string, unknown>;

test("a list of records (team members): add, move, remove through list_row; the gate keeps 1 to 12 rows", () => {
	const { page, id } = withBlock("team-simple", "cards3");
	const rows = () => (propsOf(page).members as unknown[]).length;
	assert.ok(rows() >= 1, "the sample has members");
	const a = applyOp(page, { op: "list_row", blockId: id, pointer: "/members", action: "add" });
	assert.ok(a.ok, JSON.stringify(a));
	const added = propsOf(a.page).members as Array<Record<string, unknown>>;
	assert.equal(added.length, rows() + 1);
	const up = applyOp(a.page, { op: "list_row", blockId: id, pointer: "/members", action: "up", row: added.length - 1 });
	assert.ok(up.ok, JSON.stringify(up));
	assert.deepEqual((propsOf(up.page).members as unknown[])[added.length - 2], added[added.length - 1]);
	const gone = applyOp(up.page, { op: "list_row", blockId: id, pointer: "/members", action: "remove", row: 0 });
	assert.ok(gone.ok, JSON.stringify(gone));
	assert.equal((propsOf(gone.page).members as unknown[]).length, rows());
	const nope = applyOp(page, { op: "list_row", blockId: id, pointer: "/title", action: "add" });
	assert.ok(!nope.ok);
	assert.equal(nope.code, "not_a_list");
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

test("map keys: the contract's own pattern, and a pointer-safe path for any key", () => {
	const schema = JSON.parse(readFileSync(new URL("../../packages/page-contract/schema/page-spec-v2.schema.json", import.meta.url), "utf8")) as { $defs: { props?: { propertyNames: { pattern: string } } } };
	assert.equal(PAGE_KEY_PATTERN, schema.$defs.props!.propertyNames.pattern, "the Inspector checks the very pattern the page schema enforces");
	assert.equal(mapKeyIssue("sku_1", []), null);
	assert.equal(mapKeyIssue("sku_1", ["sku_1"]), "duplicate_key");
	assert.equal(mapKeyIssue("abc", [], "^x"), "bad_key", "the item schema's own pattern applies too");
	assert.equal(pointerKey("a/b~c"), "a~1b~0c");
});

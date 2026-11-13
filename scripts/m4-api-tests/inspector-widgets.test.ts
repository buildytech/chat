/**
 * Inspector widgets beyond text (ADR 0036): typed enums, optional objects and lists that are absent, lists of plain values,
 * free-form maps. Each one is a page operation on the props, so the same gate answers a hand edit and an agent patch.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	applyOp,
	coerceEnumValue,
	emptyPage,
	inspectorModel,
	inspectorValue,
	writePage,
	type InspectorField
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

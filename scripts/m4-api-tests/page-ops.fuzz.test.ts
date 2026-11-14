/**
 * Property-based fuzz of the page operations (plan item 6, audit E-01): random op sequences with props taken from the
 * Inspector's own field model (schema-random: each value is drawn from what the field's schema allows, or from junk that
 * it must refuse). Invariants:
 *   - valid in, valid out: an accepted op yields a page the one gate accepts, with unique block ids;
 *   - a refused op names its problems and the base page is the same one it was;
 *   - the base page is never modified; an op that changes nothing returns the same page object;
 *   - undo restores: stepping back through the edit history reaches the first page, stepping forward the last;
 *   - an op is deterministic (same base, same op, same result).
 * fast-check prints the shrunk op sequence and a seed on failure; re-run with FUZZ_SEED=<seed>.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import fc from "fast-check";
import {
	addScreen,
	allItems,
	applyOp,
	checkPageDoc,
	emptyPage,
	inspectorModel,
	itemInfo,
	type InspectorField,
	type PageOp
} from "../../packages/builder-core/src/index.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import { EditHistory } from "../../apps/chat-web/src/lib/inspector/history.ts";

const NOW = "2026-11-13T12:00:00.000Z";
const ITEMS = allItems().sort();

const start = (): PageV2 => {
	const r = addScreen(emptyPage({ title: "Fuzz", locale: "en", now: NOW }), "screen.theme-marketing-landing/home");
	assert.ok(r.ok);
	return r.page;
};

/** Every editable leaf of a block, through objects, lists of records, lists of values and maps. */
function leaves(fields: InspectorField[]): InspectorField[] {
	return fields.flatMap((field) => {
		const inner = [...(field.fields ?? []), ...(field.items ?? []), ...(field.entries ?? []).map((e) => e.field), ...(field.rows ?? []).flatMap((row) => row.fields)];
		return inner.length ? leaves(inner) : [field];
	});
}

type Step = { kind: number; a: number; b: number; c: number; text: string; junk: number };
const step: fc.Arbitrary<Step> = fc.record({
	kind: fc.integer({ min: 0, max: 99 }),
	a: fc.nat(1000),
	b: fc.nat(1000),
	c: fc.nat(1000),
	text: fc.string({ maxLength: 300 }),
	junk: fc.integer({ min: 0, max: 9 })
});

/** Turn a random step into one op against the current page (the page decides which blocks, fields and slots exist). */
function opFor(page: PageV2, s: Step): PageOp {
	const blocks = page.blocks;
	const block = blocks.length ? blocks[s.a % blocks.length]! : null;
	if (!block || s.kind < 12) {
		const item = ITEMS[s.b % ITEMS.length]!;
		const variants = itemInfo(item)!.variants;
		return { op: "add", item, variant: variants[s.c % variants.length], ...(s.junk < 6 ? { at: s.c % (blocks.length + 2) } : {}) };
	}
	if (s.kind < 22) return { op: "move", blockId: block.id, to: s.b % (blocks.length + 1) };
	if (s.kind < 28) return { op: "duplicate", blockId: block.id };
	if (s.kind < 34) return { op: "remove", blockId: block.id };
	if (s.kind < 38) return { op: "reset", blockId: block.id };
	if (s.kind < 42) {
		const variants = itemInfo(block.item)?.variants ?? ["default"];
		return { op: "set_variant", blockId: block.id, variant: s.junk === 0 ? s.text : variants[s.b % variants.length]! };
	}
	if (s.kind < 46) {
		const to = ITEMS[s.b % ITEMS.length]!;
		return { op: "replace", blockId: block.id, item: to, variant: null };
	}
	if (s.kind < 50) return { op: "page", field: (["title", "slug", "locale", "seo.title", "seo.description"] as const)[s.b % 5]!, value: s.text };
	const model = inspectorModel(block);
	if (!model.ok) return { op: "set", blockId: block.id, pointer: "/title", value: s.text };
	const fields = model.fields;
	const lists = fields.filter((f) => f.list);
	if (s.kind < 58 && lists.length) {
		const list = lists[s.b % lists.length]!;
		return { op: "list_row", blockId: block.id, pointer: list.pointer, action: (["add", "remove", "up", "down", "duplicate"] as const)[s.c % 5]!, row: s.junk < 7 ? s.a % 6 : undefined };
	}
	const all = leaves(fields);
	if (!all.length) return { op: "set", blockId: block.id, pointer: "/nothing", value: s.text };
	const field = all[s.b % all.length]!;
	return { op: "set", blockId: block.id, pointer: field.pointer, value: valueFor(field, s) };
}

/** A value for the field: mostly what its widget takes, sometimes junk the gate must refuse (wrong type, too long, unknown enum value). */
function valueFor(field: InspectorField, s: Step): PageOp extends { op: "set"; value: infer V } ? V : never {
	if (s.junk === 0) return undefined;
	if (s.junk === 1) return s.text.length % 2 ? s.c : s.text;
	if (s.junk === 2) return null;
	switch (field.widget) {
		case "boolean":
			return s.c % 2 === 0;
		case "number":
			return s.c % 7 === 0 ? s.c / 3 : s.c % 100;
		case "enum": {
			const values = field.optionValues ?? field.options ?? [];
			return values.length ? values[s.c % values.length]! : s.text;
		}
		default:
			return field.maxLength && s.junk === 3 ? s.text.padEnd(field.maxLength + 5, "x") : s.text;
	}
}

/** `updatedAt` is the clock; everything else of a result must repeat. */
const stable = (value: unknown) => JSON.stringify(value).replace(/"updatedAt":"[^"]*"/g, '"updatedAt":"-"');

const seedOption = process.env.FUZZ_SEED ? { seed: Number(process.env.FUZZ_SEED) } : {};
const stats: Record<string, number> = {};
const ID = /^[a-z0-9][a-z0-9-]*$/;

test("fuzz: op sequences keep the page valid, refuse with named problems, never touch the base, and undo restores", () => {
	fc.assert(
		fc.property(fc.array(step, { minLength: 1, maxLength: 14 }), (steps) => {
			const first = start();
			let page = first;
			const history = new EditHistory<PageV2>();
			const firstJson = JSON.stringify(first);
			for (const s of steps) {
				const op = opFor(page, s);
				const before = JSON.stringify(page);
				const result = applyOp(page, op);
				assert.equal(JSON.stringify(page), before, `the base page is never modified (${JSON.stringify(op).slice(0, 200)})`);
				assert.equal(stable(applyOp(page, op)), stable(result), "an op is deterministic");
				stats[`${op.op}:${result.ok ? "ok" : "refused"}`] = (stats[`${op.op}:${result.ok ? "ok" : "refused"}`] ?? 0) + 1;
				if (!result.ok) {
					assert.ok(result.code && result.issues.length > 0, `a refused op names its problems (${JSON.stringify(op).slice(0, 200)})`);
					continue;
				}
				const gate = checkPageDoc(result.page);
				assert.ok(gate.ok, `valid in, valid out (${JSON.stringify(op).slice(0, 200)}): ${JSON.stringify(gate.ok ? [] : gate.issues.slice(0, 3))}`);
				const ids = result.page.blocks.map((b) => b.id);
				assert.equal(new Set(ids).size, ids.length, "block ids stay unique");
				assert.ok(ids.every((id) => ID.test(id)), "block ids stay well-formed");
				if (result.diff.length === 0) assert.equal(result.page, page, "an op that changes nothing returns the same page");
				else {
					history.record(page, result.page);
					page = result.page;
				}
			}
			const last = JSON.stringify(page);
			let undone = 0;
			for (let back = history.undo(); back; back = history.undo()) { page = back; undone++; }
			assert.equal(JSON.stringify(page), firstJson, `undo restores the first page after ${undone} step(s)`);
			for (let fwd = history.redo(); fwd; fwd = history.redo()) page = fwd;
			assert.equal(JSON.stringify(page), last, "redo reaches the last page");
		}),
		{ numRuns: Number(process.env.FUZZ_RUNS ?? 80), ...seedOption }
	);
});

test("fuzz: the sequences reached every operation, accepted and refused", () => {
	if (process.env.FUZZ_STATS) console.log(stats);
	for (const name of ["add", "move", "duplicate", "remove", "reset", "set_variant", "replace", "page", "list_row", "set"]) assert.ok((stats[`${name}:ok`] ?? 0) > 0, `${name} was accepted at least once`);
	for (const name of ["add", "move", "set"]) assert.ok((stats[`${name}:refused`] ?? 0) > 0, `${name} was refused at least once`);
});

test("fuzz: any one op on the start page is either valid or refused (no throw, no half page)", () => {
	fc.assert(
		fc.property(step, (s) => {
			const page = start();
			const result = applyOp(page, opFor(page, s));
			if (result.ok) assert.ok(checkPageDoc(result.page).ok);
			else assert.ok(result.issues.length > 0);
		}),
		{ numRuns: Number(process.env.FUZZ_RUNS ?? 200), ...seedOption }
	);
});

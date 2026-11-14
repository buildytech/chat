/**
 * page-spec/v2 in the chat (ADR 0034): the one gate, RFC 6902 patches, the diff, sample props for new blocks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { pageV2Issues, parsePageV2, type PageV2 } from "../../packages/page-contract/src/index.ts";
import {
	applyJsonPatch,
	checkPageDoc,
	diffPages,
	renderBlock,
	sampleProps,
	writePage
} from "../../packages/builder-core/src/index.ts";

const applied = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/fitness-applied-v2.json", import.meta.url)), "utf8")) as PageV2;

/** The owner's fitness page at revision 3 (8 blocks) as a page-spec/v2 document. */
const migrated = (_slot: "applied"): PageV2 => structuredClone(applied);

test("the gate names every problem as { path, code, expected, got }", () => {
	const page = migrated("applied");
	const bad = JSON.parse(JSON.stringify(page)) as PageV2;
	bad.blocks[1]!.props = { ...bad.blocks[1]!.props, tone: "neon" };
	bad.blocks[2]!.variant = "carousel";
	bad.blocks[3]!.item = "no-such-item";
	[bad.blocks[0], bad.blocks[7]] = [bad.blocks[7]!, bad.blocks[0]!]; // header and footer swapped: still valid (ADR 0037)
	const gate = checkPageDoc(bad);
	assert.ok(!gate.ok);
	const codes = new Set(gate.issues.map((issue) => issue.code));
	for (const code of ["props_invalid", "unknown_variant", "unknown_item"]) assert.ok(codes.has(code), `${code} in ${[...codes]}`);
	for (const code of ["header_not_first", "footer_not_last"]) assert.ok(!codes.has(code), `${code} is no check any more`);
	for (const issue of gate.issues) {
		assert.match(issue.path, /^\/(blocks\/\d+.*)?$/);
		assert.ok(issue.expected !== undefined, JSON.stringify(issue));
	}
	const tone = gate.issues.find((issue) => issue.code === "props_invalid");
	assert.equal(tone?.path, "/blocks/1/props/tone");
	assert.equal(tone?.got, "neon");
});

test("RFC 6902: add, replace, move, remove, copy, test", () => {
	const doc = { a: [1, 2, 3], o: { x: 1 } };
	const r = applyJsonPatch(doc, [
		{ op: "add", path: "/a/-", value: 4 },
		{ op: "replace", path: "/o/x", value: 2 },
		{ op: "move", from: "/a/0", path: "/a/2" },
		{ op: "copy", from: "/o", path: "/p" },
		{ op: "remove", path: "/a/0" },
		{ op: "test", path: "/o/x", value: 2 }
	] as never);
	assert.ok(r.ok);
	assert.deepEqual(r.doc, { a: [3, 1, 4], o: { x: 2 }, p: { x: 2 } });
	assert.deepEqual(doc, { a: [1, 2, 3], o: { x: 1 } }, "the base is not touched");
	const bad = applyJsonPatch(doc, [{ op: "replace", path: "/o/nope", value: 1 }, { op: "test", path: "/o/x", value: 9 }] as never);
	assert.ok(!bad.ok);
	assert.equal(bad.issues[0]!.path, "/o/nope");
});

test("a new block gets the registry sample props of its variant, not placeholder copy", () => {
	const page = migrated("applied");
	const r = writePage(page, { patch: [{ op: "add", path: "/blocks/2", value: { item: "feature-grid", variant: "grid" } }] });
	assert.ok(r.ok, JSON.stringify(r));
	const added = r.page.blocks[2]!;
	assert.equal(added.id, "block-feature-grid");
	assert.deepEqual(added.props, renderBlock({ id: added.id, item: "feature-grid", variant: "grid", props: sampleProps("feature-grid", "grid", added.id) })!.props);
	const text = JSON.stringify(added.props);
	assert.ok(!/Why this page|Novaya|Stock screen|not invented/.test(text));
	assert.deepEqual(r.diff.map((entry) => [entry.change, entry.id]), [["added", "block-feature-grid"]]);
});

test("write_page changes only what it names; untouched blocks keep their bytes", () => {
	const page = migrated("applied");
	const r = writePage(page, { patch: [{ op: "replace", path: "/blocks/1/props/title", value: "FitForge" }, { op: "replace", path: "/seo", value: { title: "FitForge", description: "A fictional fitness app." } }] });
	assert.ok(r.ok, JSON.stringify(r));
	assert.equal(r.page.blocks[1]!.props!.title, "FitForge");
	for (const index of [0, 2, 3, 4, 5, 6, 7]) assert.equal(JSON.stringify(r.page.blocks[index]), JSON.stringify(page.blocks[index]));
	assert.deepEqual(r.diff.map((entry) => [entry.scope, entry.change, entry.id ?? null, entry.paths]), [["page", "changed", null, ["/seo/title", "/seo/description"]], ["block", "changed", "block-hero", ["/props/title"]]]);
	const none = writePage(page, { page: JSON.parse(JSON.stringify(page)) });
	assert.ok(none.ok && !none.changed && none.diff.length === 0);
});

test("a rejected write changes nothing and lists the paths", () => {
	const page = migrated("applied");
	const r = writePage(page, { patch: [{ op: "replace", path: "/blocks/1/props/tone", value: "neon" }] });
	assert.ok(!r.ok);
	assert.equal(r.issues[0]!.path, "/blocks/1/props/tone");
	assert.equal(page.blocks[1]!.props!.tone, "default");
	const both = writePage(page, { page: {}, patch: [] });
	assert.ok(!both.ok);
});

test("a swapped item takes the sample props of the new item and keeps the shared text", () => {
	const page = migrated("applied");
	const before = page.blocks[2]!.props!.title;
	const r = writePage(page, { patch: [{ op: "replace", path: "/blocks/2/item", value: "steps-list" }, { op: "remove", path: "/blocks/2/variant" }] });
	assert.ok(r.ok, JSON.stringify(r));
	const block = r.page.blocks[2]!;
	assert.equal(block.item, "steps-list");
	assert.equal(block.props!.title, before);
	assert.ok(Array.isArray(block.props!.steps));
	const entry = diffPages(page, r.page)[0]!;
	assert.equal(entry.change, "changed");
	assert.ok(entry.paths!.includes("/item"));
});

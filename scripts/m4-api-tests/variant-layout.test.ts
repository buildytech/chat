/**
 * The variant is the source of truth of the layout axes (t85u step 3, page-doc/layout.ts): the host writes the axes a
 * variant sets, axes written alone pick their variant, contradictions are rejected with props_invalid at the axis,
 * and a variant switch keeps the block's content and the settings set by hand (`align`).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { applyOp, emptyPage, inspectorModel, writePage, type PageOp } from "../../packages/builder-core/src/index.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";

const NOW = "2026-11-20T09:00:00.000Z";
const base = (): PageV2 => emptyPage({ title: "T", locale: "en", id: "page-layout", now: NOW });

function withBlock(item: string, variant: string): PageV2 {
	const r = applyOp(base(), { op: "add", item, variant });
	assert.ok(r.ok, JSON.stringify(r));
	return r.page;
}
function op(page: PageV2, input: PageOp): PageV2 {
	const r = applyOp(page, input);
	assert.ok(r.ok, JSON.stringify(r));
	return r.page;
}
const team = (blocks: unknown[]) => writePage(base(), { page: { ...base(), blocks } });

test("an axis set on its own (Inspector or patch) moves the variant with it", () => {
	let page = withBlock("hero-simple", "mediaEnd");
	page = op(page, { op: "set", blockId: page.blocks[0]!.id, pointer: "/media", value: "start" });
	assert.equal(page.blocks[0]!.variant, "mediaStart");
	assert.equal(page.blocks[0]!.props.media, "start");
});

test("set_variant keeps the content and a hand-set align; a default align follows the variant", () => {
	let page = withBlock("hero-simple", "mediaEnd");
	const id = page.blocks[0]!.id;
	page = op(page, { op: "set", blockId: id, pointer: "/title", value: "Karina is 23" });
	page = op(page, { op: "set", blockId: id, pointer: "/level", value: 1 });
	const followed = op(page, { op: "set_variant", blockId: id, variant: "mediaTop" });
	assert.deepEqual([followed.blocks[0]!.variant, followed.blocks[0]!.props.media, followed.blocks[0]!.props.align], ["mediaTop", "top", "center"]);
	assert.deepEqual([followed.blocks[0]!.props.title, followed.blocks[0]!.props.level], ["Karina is 23", 1]);
	const back = op(followed, { op: "set_variant", blockId: id, variant: "mediaEnd" });
	assert.deepEqual([back.blocks[0]!.props.media, back.blocks[0]!.props.align], ["end", "start"]);
	const hand = op(page, { op: "set", blockId: id, pointer: "/align", value: "end" });
	const kept = op(hand, { op: "set_variant", blockId: id, variant: "mediaTop" });
	assert.deepEqual([kept.blocks[0]!.variant, kept.blocks[0]!.props.media, kept.blocks[0]!.props.align], ["mediaTop", "top", "end"]);
});

test("set_variant keeps the team members", () => {
	let page = withBlock("team-simple", "cols3");
	const id = page.blocks[0]!.id;
	const members = [{ id: "m1", title: "Alexey", description: "Classmate" }, { id: "m2", title: "Maria" }];
	page = op(page, { op: "set", blockId: id, pointer: "/members", value: members });
	const cards = op(page, { op: "set_variant", blockId: id, variant: "cards3" });
	assert.deepEqual([cards.blocks[0]!.props.cols, cards.blocks[0]!.props.surface], ["3", "cards"]);
	assert.deepEqual(cards.blocks[0]!.props.members, members);
});

test("a write that names a variant with contradicting axes is rejected at the axis, with the variants", () => {
	const r = team([{ item: "team-simple", variant: "cards3", props: { title: "T", cols: "2", surface: "cards", members: [{ id: "m1", title: "A" }] } }]);
	assert.equal(r.ok, false);
	const issue = !r.ok ? r.issues[0]! : null;
	assert.equal(issue?.path, "/blocks/0/props/cols");
	assert.equal(issue?.code, "props_invalid");
	assert.equal(issue?.got, "2");
	assert.match(String(issue?.expected), /variant cards3 sets cols/);
	assert.match(String(issue?.expected), /cols2 \(cols "2", surface "plain"\)/);
});

test("axes written without a variant pick the one variant that has them; none is rejected", () => {
	const two = team([{ item: "team-simple", props: { title: "T", cols: 2, members: [{ id: "m1", title: "A" }] } }]);
	assert.ok(two.ok, JSON.stringify(two));
	assert.deepEqual([two.page.blocks[0]!.variant, two.page.blocks[0]!.props.cols, two.page.blocks[0]!.props.surface], ["cols2", "2", "plain"]);
	const none = team([{ item: "team-simple", props: { title: "T", cols: "2", surface: "cards", members: [{ id: "m1", title: "A" }] } }]);
	assert.equal(none.ok, false);
	assert.match(String(!none.ok && none.issues[0]!.expected), /is none/);
});

test("a new variant over the old props (stale axes copied by the model) takes the new variant's axes", () => {
	const page = withBlock("hero-simple", "mediaEnd");
	const block = page.blocks[0]!;
	const r = writePage(page, { page: { ...page, blocks: [{ ...block, variant: "mediaStart", props: { ...block.props } }] } });
	assert.ok(r.ok, JSON.stringify(r));
	assert.deepEqual([r.page.blocks[0]!.variant, r.page.blocks[0]!.props.media], ["mediaStart", "start"]);
});

test("the Inspector has one layout control: the Variant select, no axis fields", () => {
	const page = withBlock("team-simple", "cols3");
	const model = inspectorModel(page.blocks[0]!);
	assert.ok(model.ok);
	assert.deepEqual(model.fields.filter((f) => ["cols", "surface", "media"].includes(f.name)), []);
	assert.deepEqual(model.variants, ["cols3", "cols2", "cols4", "cards3"]);
});

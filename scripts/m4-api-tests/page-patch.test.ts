/**
 * page-patch/v1 edits (edit_page): program-level gates on the trusted current page.
 * Schema shape, slot validation against page-spec x-page-slots, Stock family for add / replace,
 * demo-data intent for data rows, page-spec/v1 + parsePage + catalog provenance on the result.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PAGE_SLOTS, pageSpecIssues, parsePageSpec, type Page } from "../../packages/page-contract/src/index.ts";
import { ALLOWED_TOOLS, editPage, executeTool, normalizePatch, proposeLayout, type LayoutProposal } from "../../packages/builder-core/src/index.ts";
import { RU, ruDashboardArgs } from "./fixtures-demo.ts";
import { parseModelContent } from "../../packages/builder-core/src/content.ts";

const NOW = "2026-11-09T12:00:00.000Z";

function website(): { page: Page; provenance: { screenId: string | null; scenarioId: "website"; missing: string[] } } {
	const r = proposeLayout({ brief: "Website for a coffee house", scenarioId: "website", screenId: "screen.site/home", expectedRevision: 0, now: NOW, content: { locale: "en", blocks: [] } });
	assert.ok(r.ok);
	return { page: r.page, provenance: { screenId: r.provenance.screenId, scenarioId: "website", missing: r.missing } };
}

function dashboard(): { page: Page; provenance: { screenId: string | null; scenarioId: "dashboard"; missing: string[] } } {
	const args = ruDashboardArgs();
	const r = proposeLayout({ brief: String(args.brief), scenarioId: "dashboard", screenId: String(args.screenId), expectedRevision: 0, now: NOW, content: parseModelContent(args) });
	assert.ok(r.ok);
	return { page: r.page, provenance: { screenId: r.provenance.screenId, scenarioId: "dashboard", missing: r.missing } };
}

const ids = (page: Page) => page.layout.blocks.map((b) => b.id);

test("edit_page is an allowlisted tool", () => {
	assert.ok((ALLOWED_TOOLS as readonly string[]).includes("edit_page"));
});

test("set + move + set_page keep every other block byte-identical", () => {
	const { page, provenance } = website();
	const r = editPage({
		page,
		provenance,
		expectedRevision: 1,
		now: NOW,
		patch: {
			baseRevision: 1,
			ops: [
				{ op: "set", blockId: "block-hero", field: "headline", value: "Fresh coffee every morning" },
				{ op: "move", blockId: "block-cta", to: 2 },
				{ op: "set_page", field: "seo.description", value: "Coffee house." }
			]
		}
	});
	assert.ok(r.ok, JSON.stringify(r));
	const p = (r as LayoutProposal).page;
	assert.equal(p.layout.blocks.find((b) => b.id === "block-hero")?.copy?.headline, "Fresh coffee every morning");
	assert.deepEqual(ids(p), ["block-nav", "block-hero", "block-cta", "block-features", "block-footer"]);
	assert.equal(p.seo.description, "Coffee house.");
	for (const id of ["block-nav", "block-features", "block-footer", "block-cta"]) {
		assert.deepEqual(p.layout.blocks.find((b) => b.id === id), page.layout.blocks.find((b) => b.id === id), id);
	}
	assert.equal(p.id, page.id);
	assert.equal(p.slug, page.slug);
	assert.equal(p.createdAt, page.createdAt);
	assert.deepEqual(pageSpecIssues(p), []);
	assert.equal((r as LayoutProposal).provenance.assembler, "page-patch/v1");
	assert.equal((r as LayoutProposal).provenance.screenId, "screen.site/home");
	assert.deepEqual((r as LayoutProposal).diff.changed.sort(), ["hero", "order", "page"]);
	assert.equal((r as LayoutProposal).applied, false);
});

test("slot validation: copy keys and row fields the kind does not render are rejected", () => {
	const { page, provenance } = website();
	const base = { page, provenance, expectedRevision: 0, now: NOW };
	const brand = editPage({ ...base, patch: { ops: [{ op: "set", blockId: "block-hero", field: "brand", value: "X" }] } });
	assert.equal(brand.ok, false);
	assert.equal((brand as { code: string }).code, "slot_not_rendered");
	assert.equal((brand as { path?: string }).path, "$.ops[0].field");
	const row = editPage({ ...base, patch: { ops: [{ op: "set_items", blockId: "block-features", items: [{ label: "A", value: "1" }] }] } });
	assert.equal((row as { code: string }).code, "row_field_not_rendered");
	const noRows = editPage({ ...base, patch: { ops: [{ op: "set_items", blockId: "block-hero", items: [{ label: "A" }] }] } });
	assert.equal((noRows as { code: string }).code, "slot_no_rows");
	const tooMany = editPage({ ...base, patch: { ops: [{ op: "set_items", blockId: "block-features", items: Array.from({ length: 7 }, (_, i) => ({ label: `F${i}` })) }] } });
	assert.equal((tooMany as { code: string }).code, "rows_over_limit");
	assert.equal(PAGE_SLOTS.features.items?.max, 6);
});

test("set_items writes rows by the slot table; null removes a copy key", () => {
	const { page, provenance } = website();
	const r = editPage({
		page,
		provenance,
		expectedRevision: 0,
		now: NOW,
		patch: {
			ops: [
				{ op: "set_items", blockId: "block-features", items: [{ label: "Single origin", detail: "Three farms." }, { label: "Quiet corner" }] },
				{ op: "set", blockId: "block-hero", field: "eyebrow", value: null }
			]
		}
	});
	assert.ok(r.ok, JSON.stringify(r));
	const p = (r as LayoutProposal).page;
	const features = p.layout.blocks.find((b) => b.kind === "features")!;
	assert.deepEqual(features.children?.map((c) => [c.id, c.kind, c.title, c.summary]), [
		["block-features-item-1", "feature", "Single origin", "Three farms."],
		["block-features-item-2", "feature", "Quiet corner", "Quiet corner"]
	]);
	assert.equal(p.layout.blocks.find((b) => b.kind === "hero")?.copy?.eyebrow, undefined);
});

test("data rows need the demo-data intent and get the demo badge", () => {
	const { page, provenance } = dashboard();
	const rows = [{ label: RU.monday, value: "12" }, { label: RU.tuesday, value: "18" }];
	const plain = { ...page, layout: { ...page.layout, blocks: page.layout.blocks.map((b) => { const { copy, ...rest } = b; const c = { ...copy }; delete c.badge; return Object.keys(c).length ? { ...rest, copy: c } : rest; }) } };
	const denied = editPage({ page: plain, provenance, expectedRevision: 0, now: NOW, patch: { ops: [{ op: "set_items", blockId: "block-chart", items: rows }] } });
	assert.equal((denied as { code: string }).code, "demo_data_not_requested");
	const ok = editPage({ page: plain, provenance, expectedRevision: 0, now: NOW, demoData: true, demoLabel: RU.demo, patch: { ops: [{ op: "set_items", blockId: "block-chart", items: rows }] } });
	assert.ok(ok.ok, JSON.stringify(ok));
	const chart = (ok as LayoutProposal).page.layout.blocks.find((b) => b.kind === "chart")!;
	assert.equal(chart.copy?.badge, RU.demo);
	assert.deepEqual(chart.children?.map((c) => c.copy?.value), ["12", "18"]);
	// Sticky: a page that already shows demo data accepts more rows without the flag.
	const sticky = editPage({ page, provenance, expectedRevision: 0, now: NOW, patch: { ops: [{ op: "set_items", blockId: "block-chart", items: rows }] } });
	assert.ok(sticky.ok);
});

test("add / replace build Stock blocks from the page's screen family only", () => {
	const { page, provenance } = website();
	const notFamily = editPage({ page, provenance, expectedRevision: 0, now: NOW, patch: { ops: [{ op: "add", kind: "metrics" }] } });
	assert.equal((notFamily as { code: string }).code, "block_not_in_catalog");
	const exists = editPage({ page, provenance, expectedRevision: 0, now: NOW, patch: { ops: [{ op: "add", kind: "hero" }] } });
	assert.equal((exists as { code: string }).code, "block_exists");
	const row = editPage({ page, provenance, expectedRevision: 0, now: NOW, patch: { ops: [{ op: "add", kind: "metric" }] } });
	assert.equal((row as { code: string }).code, "page_patch_invalid");
	const noScreen = editPage({ page, provenance: { ...provenance, screenId: null }, expectedRevision: 0, now: NOW, patch: { ops: [{ op: "remove", blockId: "block-cta" }, { op: "add", kind: "cta" }] } });
	assert.equal((noScreen as { code: string }).code, "screen_unknown");

	const removed = editPage({ page, provenance, expectedRevision: 0, now: NOW, patch: { ops: [{ op: "remove", blockId: "block-cta" }] } });
	assert.ok(removed.ok);
	const back = editPage({
		page: (removed as LayoutProposal).page,
		provenance,
		expectedRevision: 1,
		now: NOW,
		patch: { ops: [{ op: "add", kind: "cta", copy: { action: "Book a table" } }] }
	});
	assert.ok(back.ok, JSON.stringify(back));
	const p = (back as LayoutProposal).page;
	assert.deepEqual(p.layout.blocks.map((b) => b.kind), ["nav", "hero", "features", "cta", "footer"], "natural Stock order");
	assert.equal(p.layout.blocks.find((b) => b.kind === "cta")?.copy?.action, "Book a table");
	assert.deepEqual((back as LayoutProposal).diff.added, ["cta"]);
	const badCopy = editPage({ page: (removed as LayoutProposal).page, provenance, expectedRevision: 1, now: NOW, patch: { ops: [{ op: "add", kind: "cta", copy: { brand: "X" } }] } });
	assert.equal((badCopy as { code: string }).code, "slot_not_rendered");
});

test("a non-English page needs model copy for a new block (no English catalog text leaks)", () => {
	const { page, provenance } = dashboard();
	const gone = editPage({ page, provenance, expectedRevision: 0, now: NOW, patch: { ops: [{ op: "remove", blockId: "block-activity" }] } });
	assert.ok(gone.ok);
	const bare = editPage({ page: (gone as LayoutProposal).page, provenance, expectedRevision: 0, now: NOW, patch: { ops: [{ op: "add", kind: "activity" }] } });
	assert.equal((bare as { code: string }).code, "slot_required");
	const titled = editPage({ page: (gone as LayoutProposal).page, provenance, expectedRevision: 0, now: NOW, patch: { ops: [{ op: "add", kind: "activity", title: RU.tasks, copy: { lede: RU.lede } }] } });
	assert.ok(titled.ok, JSON.stringify(titled));
});

test("all or nothing: one bad op rejects the patch and the base page is untouched", () => {
	const { page, provenance } = website();
	const before = JSON.stringify(page);
	const r = editPage({
		page,
		provenance,
		expectedRevision: 0,
		now: NOW,
		patch: { ops: [{ op: "set", blockId: "block-hero", field: "headline", value: "New" }, { op: "remove", blockId: "block-nope" }] }
	});
	assert.equal(r.ok, false);
	assert.equal((r as { code: string }).code, "block_not_found");
	assert.equal((r as { path?: string }).path, "$.ops[1].blockId");
	assert.equal(JSON.stringify(page), before);
});

test("schema gate: caller layouts, markup and stale revisions are rejected", () => {
	const { page, provenance } = website();
	const base = { page, provenance, expectedRevision: 2, now: NOW };
	assert.equal((editPage({ ...base, patch: { ops: [{ op: "set", blockId: "block-hero", field: "lede", value: "<script>x</script>" }] } }) as { code: string }).code, "page_patch_invalid");
	assert.equal((editPage({ ...base, patch: { ops: [{ op: "set", blockId: "block-hero", field: "lede", value: "x" }], baseRevision: 1 } }) as { code: string }).code, "revision_conflict");
	assert.equal((editPage({ ...base, patch: { ops: [{ op: "set", blockId: "block-hero", field: "title", value: " " }] } }) as { code: string }).code, "slot_required");
	const tool = executeTool({ name: "edit_page", arguments: { layout: page.layout, ops: [] } }, { currentPage: page, currentProvenance: provenance });
	assert.equal(tool.ok, false);
	assert.equal((tool as { code: string }).code, "untrusted_layout");
	const noPage = executeTool({ name: "edit_page", arguments: { ops: [{ op: "remove", blockId: "block-cta" }] } }, {});
	assert.equal((noPage as { code: string }).code, "missing_page");
});

test("tool-call hygiene: empty union fields are dropped, real extra keys still fail", () => {
	const n = normalizePatch({ ops: [{ op: "remove", blockId: "block-cta", field: null, value: null, items: [], copy: {}, kind: "" }] }) as { ops: unknown[] };
	assert.deepEqual(n.ops, [{ op: "remove", blockId: "block-cta" }]);
	const kept = normalizePatch({ ops: [{ op: "remove", blockId: "block-cta", title: "x" }] }) as { ops: unknown[] };
	assert.deepEqual(kept.ops, [{ op: "remove", blockId: "block-cta", title: "x" }]);
	const { page, provenance } = website();
	const r = executeTool(
		{ name: "edit_page", arguments: { ops: [{ op: "set", blockId: "block-hero", field: "headline", value: "Hi", items: null, kind: null }] } },
		{ currentPage: page, currentProvenance: provenance }
	);
	assert.ok(r.ok, JSON.stringify(r));
});

test("proposals and saved pages pass the published page-spec/v1 schema", () => {
	const { page } = website();
	assert.deepEqual(pageSpecIssues(page), []);
	assert.deepEqual(pageSpecIssues(dashboard().page), []);
	assert.throws(() => parsePageSpec({ ...page, layout: { version: 1, blocks: [{ ...page.layout.blocks[0], kind: "carousel" }] } }), /page_spec_invalid/);
});

/**
 * Owner-approved (t187u): a new block's required lists start with two neutral placeholder rows (schema-valid, English,
 * ISO currency), so the variants whose sample rendered nothing (empty lists) now show content.
 * Required label/text strings of a sample are the humanized key ("Home"), so a labels-only block (site-footer) renders; agent writes are not filled this way.
 * Also: the chat badge says "proposal" when the message carries one.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { addScreen, catalogSnapshot, checkPageDoc, emptyPage, renderBlock, sampleProps, showsContent } from "../../packages/builder-core/src/index.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("required lists of a sample start with two rows; rows are unique, English, schema-valid", () => {
	for (const [item, variant, list] of [["nav-bar", "inline", "links"], ["bottom-nav", "labels", "tabs"], ["category-nav", "chips", "categories"], ["faq-split", "headSplit", "items"], ["signup-wizard", "bar", "steps"], ["sitemap-footer", "columns", "groups"], ["dish-showcase", "grid4", "dishes"]] as const) {
		const props = sampleProps(item, variant, "b1");
		const rows = props[list] as Array<Record<string, unknown>>;
		assert.equal(rows.length, 2, `${item}.${list}`);
		const ids = rows.map((row) => row.id).filter((id) => id !== undefined);
		assert.equal(new Set(ids).size, ids.length, `${item}.${list} ids are unique`);
		for (const row of rows) for (const value of Object.values(row)) if (typeof value === "string") assert.doesNotMatch(value, /[^\x00-\x7f]/, `${item}.${list} is ASCII`);
		const page = { ...emptyPage({ title: "t", now: "2026-11-14T12:00:00.000Z" }), blocks: [{ id: "b1", item, variant, props }] } as unknown as PageV2;
		assert.ok(checkPageDoc(page).ok, `${item}/${variant} sample is schema-valid`);
	}
	const dishes = sampleProps("dish-showcase", "grid4", "b1").dishes as Array<{ currency: string }>;
	assert.deepEqual(dishes.map((d) => d.currency), ["USD", "USD"], "currency is an ISO code");
});

test("coverage file: the sample renders content for every combination (empty labels are the humanized key)", () => {
	const coverage = JSON.parse(read("../../catalog/inspector-coverage.json")) as { combos?: Record<string, { rendersSample?: string }>; items?: Record<string, { rendersSample?: string }> };
	const rows = Object.entries(coverage.combos ?? coverage.items ?? {});
	assert.ok(rows.length >= 532, `${rows.length} combinations`);
	assert.deepEqual(rows.filter(([, row]) => row.rendersSample === "empty").map(([key]) => key).sort(), []);
	assert.deepEqual(sampleProps("site-footer", "minimal", "b1").labels, { copyright: "Copyright", nav: "Nav", home: "Home", pricing: "Pricing" });
});

test("the chat badge says proposal when the message has one", () => {
	const view = read("../../apps/chat-web/src/modules/chat/ui/ChatMessage.svelte");
	assert.match(view, /message\.mode === "ask" \? t\("ask\.answerAsk"\) : proposal \? t\("ask\.answerBuildProposal"\) : t\("ask\.answerBuild"\)/);
});

test("addScreen: every navbar / header / footer / sidebar block of every Stock screen renders its placeholders (none blank)", async () => {
	const mod = (await import(pathToFileURL(fileURLToPath(new URL("../../api/runtime/_render/blocks.mjs", import.meta.url))).href)) as { blocks: Record<string, unknown>; render: (c: unknown, o: { props: Record<string, unknown> }) => { body: string } };
	let chrome = 0;
	const blank: string[] = [];
	for (const screen of catalogSnapshot.screens) {
		const added = addScreen(emptyPage({ title: "t", locale: "en", now: "2026-11-14T12:00:00.000Z" }), screen.screenId);
		if (!added.ok) continue;
		for (const block of added.page.blocks) {
			if (!/nav|header|footer/.test(block.item)) continue;
			const rendered = renderBlock(block);
			if (!rendered) continue;
			chrome += 1;
			if (!showsContent(mod.render(mod.blocks[rendered.organism], { props: rendered.props }).body)) blank.push(`${screen.screenId}: ${block.item}`);
		}
	}
	assert.ok(chrome > 100, `${chrome} chrome blocks seen`);
	assert.deepEqual(blank, []);
});

test("the preview error alerts use the filled destructive pair (readable on the dark page theme too)", () => {
	const view = read("../../apps/chat-web/src/app/PreviewBlock.svelte");
	assert.match(view, /const failedTone = "bg-destructive text-destructive-foreground"/);
	assert.equal((view.match(/variant="destructive" class=\{failedTone\}/g) ?? []).length, 3);
});

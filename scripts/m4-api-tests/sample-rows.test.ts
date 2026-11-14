/**
 * Owner-approved (t187u): a new block's required lists start with two neutral placeholder rows (schema-valid, English,
 * ISO currency), so the 28 variants whose sample rendered nothing (empty lists) now show content. Where the block shows
 * nothing for another reason (site-footer: its whole content is blank label text) the coverage file says so.
 * Also: the chat badge says "proposal" when the message carries one.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkPageDoc, emptyPage, sampleProps } from "../../packages/builder-core/src/index.ts";
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

test("coverage file: the sample renders content for every combination but the site-footer (labels only, blank by design)", () => {
	const coverage = JSON.parse(read("../../catalog/inspector-coverage.json")) as { combos?: Record<string, { rendersSample?: string }>; items?: Record<string, { rendersSample?: string }> };
	const rows = Object.entries(coverage.combos ?? coverage.items ?? {});
	assert.ok(rows.length >= 532, `${rows.length} combinations`);
	assert.deepEqual(rows.filter(([, row]) => row.rendersSample === "empty").map(([key]) => key).sort(), ["site-footer/centered", "site-footer/compact", "site-footer/minimal"]);
});

test("the chat badge says proposal when the message has one", () => {
	const view = read("../../apps/chat-web/src/modules/chat/ui/ChatMessage.svelte");
	assert.match(view, /message\.mode === "ask" \? t\("ask\.answerAsk"\) : proposal \? t\("ask\.answerBuildProposal"\) : t\("ask\.answerBuild"\)/);
});

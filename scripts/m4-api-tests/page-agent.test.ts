/**
 * ADR 0034 acceptance replay: the owner's fitness session (13.11) with the model's tool calls scripted. Ask and Build
 * share one write_page tool and one proposal; every failure is a list of { path, code, expected, got }.
 *  (a) Ask "use this screen as a hint, choose or replace blocks, present a fictional fitness app": one proposal, a
 *      features grid replaces the logos, a plain4 stats band replaces the quote split, a steps row and a pricing grid
 *      are added; no no_change noise; applying it takes one step with sample props.
 *  (b) Build "fill the page with fictional content", nothing selected: one write_page over all 8 blocks within 3 requests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { addScreen, allItems, checkPageDoc, effectiveProps, emptyPage, itemInfo, sampleProps, writePage } from "../../packages/builder-core/src/index.ts";
import { type AgentReply, type PageProposal } from "../../packages/chat-agent/src/index.ts";
import { validateItemProps } from "../../packages/builder-core/src/catalog/provenance.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { MODEL, signal, toolNames, withProvider, type Scripted } from "./agent-replay.ts";

const here = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const session = JSON.parse(readFileSync(here("fitness-session-3933dbf.json"), "utf8"));
const fill = JSON.parse(readFileSync(here("fitness-fill.json"), "utf8")) as { title: string; locale: string; seo: { title: string; description: string }; props: Record<string, Record<string, unknown>> };
const ASK_PROMPT: string = session.sessions[0].messages[0].text;
const BUILD_PROMPT: string = session.sessions[0].messages[8].text;
const NOW = "2026-11-13T12:00:00.000Z";
const SCREEN = "screen.theme-marketing-landing/teams";

/** The owner's teams page as the page document (the six blocks of the 13.11 session; the FAQ split is not part of it). */
function teamsPage(): PageV2 {
	const added = addScreen(emptyPage({ title: "Pulse fitness", locale: "en", now: NOW }), SCREEN);
	assert.ok(added.ok, JSON.stringify(added));
	const removed = writePage(added.page, { patch: [{ op: "remove", path: `/blocks/${added.page.blocks.findIndex((b) => b.id === "block-faq-split")}` }] }, { now: NOW });
	assert.ok(removed.ok);
	return removed.page;
}

/** The owner's page at revision 3 (8 blocks), migrated 1.x -> 2.0. */
function fitnessPage(): PageV2 {
	return JSON.parse(readFileSync(here("fitness-applied-v2.json"), "utf8")) as PageV2;
}

const PLACEHOLDERS = /Why this page|Stock screen|not invented|Not published|Draft in this browser|Not a live site|Catalog blocks only|State the product in the author|Testimonials and logos wait|\u041d\u043e\u0432\u0430\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430|"(?:Cta|Proof|Title|Text|Label|Value|Hint|Brand)"/;

test("(a) Ask: one proposal replaces logos and quotes, adds steps and pricing; Ask never applies; Apply is one step with sample props", async () => {
	const base = teamsPage();
	assert.deepEqual(base.blocks.map((b) => `${b.item}/${b.variant}`), ["nav-bar/inline", "hero-split/quoteStats", "logo-cloud/row", "quote-split/ratingPanel", "cta-proof/splitStats", "sitemap-footer/columns"]);
	const before = JSON.stringify(base);
	const script: Scripted[] = [
		{ calls: ["feature-grid", "stats-band", "steps-list", "pricing-tiers"].map((item) => ({ name: "get_block", arguments: { item } })) },
		{
			content: "I would swap the logos for a features grid.",
			calls: [
				{
					name: "write_page",
					arguments: {
						patch: [
							{ op: "replace", path: "/blocks/2/item", value: "feature-grid" },
							{ op: "replace", path: "/blocks/2/variant", value: "grid" },
							{ op: "replace", path: "/blocks/3/item", value: "stats-band" },
							{ op: "replace", path: "/blocks/3/variant", value: "plain4" },
							{ op: "add", path: "/blocks/4", value: { item: "steps-list", variant: "row" } },
							{ op: "add", path: "/blocks/5", value: { item: "pricing-tiers", variant: "grid" } }
						]
					}
				}
			]
		},
		{ content: "Proposal: features grid instead of logos, a stats band instead of the quote split, plus steps and pricing. Apply it in Build." }
	];
	const { result, seen } = await withProvider(script, async (seen) => ({
		result: await runXaiCatalogTurn("k", MODEL, { brief: ASK_PROMPT, mode: "ask", page: base, expectedRevision: 3, screenId: SCREEN }, signal()),
		seen
	}));
	assert.equal(JSON.stringify(base), before, "Ask does not touch the page");
	assert.ok(seen.requests.length <= 3, `${seen.requests.length} requests`);
	assert.deepEqual(toolNames(seen.requests[0]!).sort(), ["get_block", "get_page", "search_catalog", "write_page"]);
	const reply = result.result as AgentReply;
	assert.ok(reply.ok && reply.proposal, JSON.stringify(result.result));
	const proposal = reply.proposal as PageProposal;
	assert.equal(proposal.baseRevision, 3);
	assert.deepEqual(proposal.page.blocks.map((b) => `${b.item}/${b.variant}`), [
		"nav-bar/inline",
		"hero-split/quoteStats",
		"feature-grid/grid",
		"stats-band/plain4",
		"steps-list/row",
		"pricing-tiers/grid",
		"cta-proof/splitStats",
		"sitemap-footer/columns"
	]);
	assert.deepEqual(proposal.diff.map((entry) => `${entry.change} ${entry.id} ${entry.item ?? ""}`), [
		"changed block-logo-cloud feature-grid",
		"changed block-quote-split stats-band",
		"added block-steps-list steps-list",
		"added block-pricing-tiers pricing-tiers"
	]);
	assert.ok(!JSON.stringify(proposal.diff).includes("no_change"));
	// New blocks start from registry sample props: structure, the catalog title and neutral placeholders (the humanized key), no invented copy.
	for (const id of ["block-steps-list", "block-pricing-tiers"]) {
		const block = proposal.page.blocks.find((b) => b.id === id)!;
		assert.deepEqual(block.props, effectiveProps(block.item, block.variant, sampleProps(block.item, block.variant, id), { blank: true }));
	}
	// Apply in Build: the proposal page is the next page of the chat; the same gate accepts it in one step.
	const applied = writePage(base, { page: proposal.page }, { now: NOW });
	assert.ok(applied.ok, JSON.stringify(applied));
	assert.deepEqual(applied.diff, proposal.diff);
	assert.equal(applied.page.blocks.length, 8);
});

test("(b) Build: fill the page with fictional content, nothing selected: one write_page over all 8 blocks in 2 requests", async () => {
	const base = fitnessPage();
	assert.equal(base.blocks.length, 8);
	const next = JSON.parse(JSON.stringify(base)) as PageV2;
	next.title = fill.title;
	next.locale = fill.locale;
	next.seo = fill.seo;
	for (const block of next.blocks) block.props = { ...block.props, ...fill.props[block.id]! };
	const script: Scripted[] = [
		{ content: "Writing the page.", calls: [{ name: "write_page", arguments: { page: next } }] },
		{ content: "Done: every block has content, the locale is ru." }
	];
	const { out, seen } = await withProvider(script, async (seen) => ({
		out: await runXaiCatalogTurn("k", MODEL, { brief: BUILD_PROMPT, mode: "build", page: base, expectedRevision: 3 }, signal()),
		seen
	}));
	assert.ok(seen.requests.length <= 3, `${seen.requests.length} requests`);
	assert.equal(out.meta.toolsCalled.filter((name) => name === "write_page").length, 1);
	const reply = out.result as AgentReply;
	assert.ok(reply.ok && reply.proposal, JSON.stringify(out.result));
	const page = reply.proposal!.page;
	assert.equal(page.locale, "ru");
	assert.equal(page.title, fill.title);
	assert.ok(page.seo?.title && page.seo?.description);
	assert.deepEqual(reply.proposal!.diff.filter((entry) => entry.scope === "block").map((entry) => entry.id), base.blocks.map((b) => b.id), "all 8 blocks changed");
	const hero = page.blocks.find((b) => b.id === "block-hero")!;
	assert.equal(hero.variant, "quoteStats");
	const content = hero.props!.content as { people: Array<{ quote: string }>; stats: unknown[] };
	assert.ok(content.people[0]!.quote.length > 20 && content.stats.length >= 3);
	assert.ok(!PLACEHOLDERS.test(JSON.stringify(page)), JSON.stringify(page).match(PLACEHOLDERS)?.[0]);
	assert.ok(checkPageDoc(page).ok);
	assert.equal(out.meta.usage.totalTokens, 1100 * seen.requests.length);
});

test("scope: with selected blocks only those change; a write outside them is rejected with paths", async () => {
	const base = fitnessPage();
	const bad = [{ op: "replace", path: "/title", value: "Other" }];
	const good = [{ op: "replace", path: "/blocks/1/props/title", value: "Train with FitForge" }];
	const { out, seen } = await withProvider(
		[
			{ calls: [{ name: "write_page", arguments: { patch: bad } }] },
			{ calls: [{ name: "write_page", arguments: { patch: good } }] },
			{ content: "Changed the hero title." }
		],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "Rename the hero", mode: "build", page: base, expectedRevision: 3, scopeBlockIds: ["block-hero"] }, signal()), seen })
	);
	assert.equal(seen.requests.length, 3);
	const first = (seen.toolMessages[0]!.content as { issues: Array<{ code: string; path: string }> }).issues;
	assert.equal(first[0]!.code, "outside_scope");
	const reply = out.result as AgentReply;
	assert.ok(reply.ok && reply.proposal, JSON.stringify(out.result));
	assert.deepEqual(reply.proposal!.diff.map((entry) => [entry.change, entry.id, entry.paths]), [["changed", "block-hero", ["/props/title"]]]);
});

test("a rejected write comes back as { path, code, expected, got }; the model fixes it and the turn proposes", async () => {
	const base = fitnessPage();
	const { out, seen } = await withProvider(
		[
			{ calls: [{ name: "write_page", arguments: { patch: [{ op: "replace", path: "/blocks/1/props/tone", value: "neon" }] } }] },
			{ calls: [{ name: "write_page", arguments: { patch: [{ op: "replace", path: "/blocks/1/props/tone", value: "muted" }] } }] },
			{ content: "Hero tone is muted now." }
		],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "Mute the hero", mode: "build", page: base, expectedRevision: 3 }, signal()), seen })
	);
	assert.equal(seen.requests.length, 3);
	const issues = (seen.toolMessages[0]!.content as { issues: Array<{ path: string; code: string; expected: string; got: unknown }> }).issues;
	assert.equal(issues[0]!.path, "/blocks/1/props/tone");
	assert.equal(issues[0]!.code, "props_invalid");
	assert.match(issues[0]!.expected, /default \| muted/);
	assert.equal(issues[0]!.got, "neon");
	assert.ok((out.result as AgentReply).proposal);
});

test("loop guard: the same error list twice ends the turn, nothing is written", async () => {
	const base = fitnessPage();
	const bad = { patch: [{ op: "replace", path: "/blocks/1/props/tone", value: "neon" }] };
	const { out, seen } = await withProvider([{ calls: [{ name: "write_page", arguments: bad }] }], async (seen) => ({
		out: await runXaiCatalogTurn("k", MODEL, { brief: "Mute the hero", mode: "build", page: base, expectedRevision: 3 }, signal()),
		seen
	}));
	assert.equal(seen.requests.length, 2);
	assert.ok(!out.result.ok);
	if (!out.result.ok) {
		assert.equal(out.result.code, "write_stuck");
		assert.equal(out.result.issues![0]!.path, "/blocks/1/props/tone");
	}
});

test("loop guard: a different rejected value at the same path is a new attempt, not a repeat", async () => {
	const base = fitnessPage();
	const attempt = (value: string) => ({ patch: [{ op: "replace", path: "/blocks/1/props/tone", value }] });
	const good = { patch: [{ op: "replace", path: "/blocks/1/props/tone", value: "muted" }] };
	const { out, seen } = await withProvider(
		[{ calls: [{ name: "write_page", arguments: attempt("neon") }] }, { calls: [{ name: "write_page", arguments: attempt("pink") }] }, { calls: [{ name: "write_page", arguments: good }] }, { content: "Muted the hero." }],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "Mute the hero", mode: "build", page: base, expectedRevision: 3 }, signal()), seen })
	);
	assert.equal(seen.requests.length, 4);
	assert.ok(out.result.ok, JSON.stringify(out.result));
});

test("every item variant starts from sample props that pass the registry props schema (no invented copy)", () => {
	let checked = 0;
	for (const item of allItems()) {
		for (const variant of itemInfo(item)!.variants) {
			const props = sampleProps(item, variant, `block-${item}`);
			const issues = validateItemProps(item, effectiveProps(item, variant, props));
			assert.deepEqual(issues, [], `${item}/${variant}`);
			checked += 1;
		}
	}
	assert.ok(checked > 400);
});

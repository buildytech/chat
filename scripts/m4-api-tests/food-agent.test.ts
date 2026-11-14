/**
 * ADR 0034 acceptance replay 2: the owner's food session (13.11, "Shashlyk Mashlyk" delivery landing page) with the
 * model's tool calls scripted; the host (search, write, gate, migration, render) is the real one.
 *  1. field mapping: props are the single source; no rendered block shows a fill-in ("Value", "By line") or a v1 service text
 *     once props are set, and the preview setting that hides service labels is honoured.
 *  2. right screen: a food/delivery request finds the food screens and dish blocks through the general Stock search.
 *     Replacing a block with a dish block takes the dish sample props.
 *  3. assembly and content in ONE write_page (3 model requests, no empty blocks).
 *  4. an unknown Lucide icon is rejected with its path and the nearest real names; the page title comes from the request.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { blankRequired, checkPageDoc, effectiveProps, emptyPage, itemInfo, renderBlock, sampleProps, screenItems, writePage } from "../../packages/builder-core/src/index.ts";
import { executeCatalogTool, runWriteTool, type AgentReply } from "../../packages/chat-agent/src/index.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { MODEL, signal, toolNames, withProvider, type Scripted } from "./agent-replay.ts";

const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const read = (name: string) => readFileSync(here(name), "utf8");
const session = JSON.parse(read("./fixtures/food-session-3933dbf.json"));
const fill = JSON.parse(read("./fixtures/food-fill.json")) as PageV2;
const BRIEF: string = session.sessions[0].messages[0].text;
const NOW = "2026-11-13T12:00:00.000Z";
const FOOD_SCREEN = /food|restaurant|grill/;
const FOOD_ITEM = /dish|menu|order|grill|combo|delivery/;

/** What the v1 host showed instead of data: the humanized prop name of a required text and its own captions. */
const FILL_INS = /"(?:Value|By line|Role|Company|Handle|Time|Hint|Label|Title|Text)"|Closing band|Contact facts are not invented|no data in the draft|\u0412 \u044d\u0442\u043e\u043c \u0447\u0435\u0440\u043d\u043e\u0432\u0438\u043a\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445/;

const foodPage = (): PageV2 => {
	return JSON.parse(read("./fixtures/food-applied-v2.json")) as PageV2;
};
const newPage = (): PageV2 => emptyPage({ title: "New page", locale: "en", now: NOW });

test("1. field mapping: the migrated food page has no fill-in or service text, stats keep their figures, the setting hides service labels", () => {
	const page = foodPage();
	assert.equal(page.blocks.length, 10);
	for (const block of page.blocks) {
		const props = JSON.stringify(renderBlock(block)!.props);
		assert.ok(!FILL_INS.test(props), `${block.id}: ${props.match(FILL_INS)?.[0]}`);
	}
	const stats = renderBlock(page.blocks.find((b) => b.item === "stats-band")!)!.props as { stats: Array<{ value: string; label: string }> };
	assert.ok(stats.stats.length >= 3 && stats.stats.every((row) => row.value !== "" && row.label !== ""), JSON.stringify(stats.stats));
	assert.ok(checkPageDoc(page).ok);
	// previewHideServiceLabels: the setting is read by the preview, and the service bar of a block exists only without it.
	assert.equal(session.settings.previewHideServiceLabels, true);
	const block = read("../../apps/chat-web/src/app/PreviewBlock.svelte");
	assert.match(block, /\{#if !clean\}/);
	assert.match(read("../../apps/chat-web/src/app/PreviewPane.svelte"), /const clean = \$derived\(previewSettings\.hideServiceLabels\)/);
});

test("2. ranking: the food request finds food screens and dish blocks through the general Stock search", () => {
	// The catalog vocabulary is English: the model turns the request into the query (the Russian brief itself is not a query).
	for (const q of ["food delivery", "restaurant delivery dishes menu", "grill delivery", "delivery landing page for a restaurant: grilled dishes"]) {
		const out = executeCatalogTool({ name: "search_catalog", arguments: { q } }, { mode: "build" });
		assert.ok(out.ok, q);
		const items = (out.result as { items: Array<{ screenId: string; sections: Array<{ item: string }> }> }).items;
		assert.ok(items.length > 0, q);
		assert.ok(FOOD_SCREEN.test(items[0]!.screenId), `${q}: ${items.map((i) => i.screenId).join(" ")}`);
		assert.ok(items[0]!.sections.some((s) => FOOD_ITEM.test(s.item)), `${q}: dish blocks on ${items[0]!.screenId}`);
		assert.ok(!items.some((i) => /marketing-landing/.test(i.screenId)), `${q}: generic landing is not a food hit`);
	}
	for (const screen of ["screen.theme-food-delivery/home", "screen.theme-food-grill/home", "screen.theme-restaurant-house/home"]) assert.deepEqual(screenItems(screen)!.missing, [], screen);
});

test("3. Build: assembly and content in ONE write_page, 2 model requests, nothing empty, the title from the request", async () => {
	const base = newPage();
	const script: Scripted[] = [
		{
			calls: [
				{ name: "search_catalog", arguments: { q: "food delivery restaurant dishes" } },
				{ name: "get_block", arguments: { item: "dish-showcase" } },
				{ name: "get_block", arguments: { item: "quick-order" } }
			]
		},
		{ content: "Writing the page.", calls: [{ name: "write_page", arguments: { page: fill } }] },
		{ content: "Done: the page is assembled with content." }
	];
	const { out, seen } = await withProvider(script, async (seen) => ({
		out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page: base, expectedRevision: 0 }, signal()),
		seen
	}));
	assert.deepEqual(toolNames(seen.requests[0]!).sort(), ["get_block", "get_page", "search_catalog", "write_page"]);
	assert.equal(seen.requests.length, 2);
	assert.equal(out.meta.toolsCalled.filter((name) => name === "write_page").length, 1);
	assert.equal(out.meta.usage.totalTokens, 1100 * 2);
	const reply = out.result as AgentReply;
	assert.ok(reply.ok && reply.proposal, JSON.stringify(out.result));
	const page = reply.proposal!.page;
	assert.equal(page.locale, "ru");
	assert.notEqual(page.title, "Marketing landing");
	assert.equal(page.title, fill.title);
	assert.ok(page.title.length > 10 && page.seo?.description);
	assert.ok(page.blocks.some((b) => b.item === "dish-showcase") && page.blocks.some((b) => b.item === "quick-order"));
	assert.ok(!page.blocks.some((b) => b.item === "logo-cloud"));
	// the screenshot hero shows its image: the variant preset sets it, the write did not have to.
	const hero = page.blocks.find((b) => b.item === "hero-classic")!;
	assert.equal(hero.variant, "screenshot");
	assert.deepEqual((renderBlock(hero)!.props as { media: { kind: string } }).media.kind, "image");
	for (const block of page.blocks) {
		assert.deepEqual(blankRequired(block), [], `${block.id} has empty required text`);
		assert.ok(!FILL_INS.test(JSON.stringify(renderBlock(block)!.props)), block.id);
	}
	// no fill hint: the accepted write left no required text empty, so the turn ended on it
	// the search the model ran put food screens first
	const searched = seen.toolMessages.find((m) => m.name === "search_catalog")!.content as { items: Array<{ screenId: string }> };
	assert.ok(FOOD_SCREEN.test(searched.items[0]!.screenId), JSON.stringify(searched).slice(0, 300));
});

test("4. a write that leaves required text empty is told which paths; unknown icons are rejected with the path, then fixed", async () => {
	const base = newPage();
	const bareHero = { ...fill, blocks: fill.blocks.map((b) => (b.id === "block-hero" ? { id: b.id, item: b.item, variant: b.variant } : b)) };
	const badIcons = JSON.parse(JSON.stringify(fill)) as PageV2;
	const links = (badIcons.blocks[0]!.props as { links: Array<{ icon: string }> }).links;
	[links[0]!.icon, links[1]!.icon, links[2]!.icon] = ["home", "lamb", "chicken"];
	const script: Scripted[] = [
		{ calls: [{ name: "write_page", arguments: { page: badIcons } }] },
		{ calls: [{ name: "write_page", arguments: { page: fill } }] },
		{ content: "Never asked for." }
	];
	const { out, seen } = await withProvider(script, async (seen) => ({
		out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page: base, expectedRevision: 0 }, signal()),
		seen
	}));
	assert.equal(seen.requests.length, 2, "the accepted write ends the turn");
	const rejected = (seen.requests[1]!.messages as Array<{ role: string; content?: string }>).filter((m) => m.role === "tool").map((m) => JSON.parse(m.content!) as { issues: Array<{ path: string; code: string; expected: string; got: unknown }> });
	assert.deepEqual(rejected[0]!.issues.map((i) => [i.path, i.code, i.got]), [
		["/blocks/0/props/links/0/icon", "props_invalid", "home"],
		["/blocks/0/props/links/1/icon", "props_invalid", "lamb"],
		["/blocks/0/props/links/2/icon", "props_invalid", "chicken"]
	]);
	assert.match(rejected[0]!.issues[0]!.expected, /not one, nearest: .*; any other real name works/);
	// the fill hint of an accepted write that leaves required text empty (the turn itself ends on the accepted write)
	const bare = runWriteTool({ brief: BRIEF, mode: "build", page: base, expectedRevision: 0 }, base, { page: bareHero });
	assert.ok(bare.ok);
	const hint = (bare.ok ? bare.payload.empty_required_text : []) as Array<{ id: string; paths: string[] }>;
	assert.deepEqual(hint.map((h) => h.id), ["block-hero"]);
	assert.ok(hint[0]!.paths.includes("/title") || hint[0]!.paths.includes("/text"), JSON.stringify(hint));
	assert.ok(((out.result as AgentReply).proposal?.page.blocks.length ?? 0) === 8);
});

test("5. Ask proposal: replacing a block with a dish block takes the dish sample props and a valid variant; the second replace does not fail", () => {
	const base = foodPage();
	const at = (id: string) => base.blocks.findIndex((b) => b.id === id);
	const logos = at("block-logos");
	const stats = at("block-stats");
	assert.ok(logos > 0 && stats > 0);
	const w = writePage(
		base,
		{
			patch: [
				{ op: "replace", path: `/blocks/${logos}/item`, value: "dish-showcase" },
				{ op: "replace", path: `/blocks/${stats}/item`, value: "menu-board" }
			]
		},
		{ now: NOW }
	);
	assert.ok(w.ok, JSON.stringify(!w.ok && w.issues));
	for (const [index, item] of [[logos, "dish-showcase"], [stats, "menu-board"]] as const) {
		const block = w.page.blocks[index]!;
		assert.equal(block.item, item);
		assert.ok(itemInfo(item)!.variants.includes(block.variant!), `${item}/${block.variant}`);
		const sample = effectiveProps(item, block.variant, sampleProps(item, block.variant, block.id), { blank: true }) as Record<string, unknown>;
		for (const key of Object.keys(sample)) if (key !== "title" && key !== "id") assert.deepEqual((block.props as Record<string, unknown>)[key], sample[key], `${item}.${key}`);
	}
	assert.ok(w.warnings.some((note) => /default variant/.test(note)), w.warnings.join(" | "));
	assert.ok(!JSON.stringify(w.diff).includes("no_change"));
});

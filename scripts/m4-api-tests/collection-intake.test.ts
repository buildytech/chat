// Stock collection intake (buildy-collection:v1, ui8kit/contract docs/collection-intake.md; alexy-os/chaosbun#151):
// decode / schema / program checks, the split against the pinned snapshot, the session 1.3.0 field, and Build bounds
// through the ADR 0018 repair loop (outside_collection, collection_item_unused, host prune). Catalog data only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	COLLECTION_MAX_BYTES,
	collectionIssues,
	decodeCollectionParam,
	isCollectionDoc,
	parseCollection,
	type CollectionDoc
} from "../../packages/page-contract/src/collection.ts";
import { sessionDefIssues } from "../../packages/page-contract/src/session.ts";
import {
	collectionBounds,
	catalogVariantsFor,
	collectionIntakeDraft,
	collectionPromptContext,
	executeTool,
	modelCatalogSources,
	placeCollectionDraft,
	mapChatRunRequest,
	repairCollectionArgs,
	snapshotDigest,
	splitCollection
} from "../../packages/builder-core/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { splitCollectionParam } from "../../apps/chat-web/src/lib/browser/collection-intake.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../packages/page-contract/fixtures/collection/${name}.json`, import.meta.url), "utf8")) as CollectionDoc;
const b64url = (text: string) => Buffer.from(text, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const SCREEN = "screen.site/home";
const MODEL = "grok-4.20-0309-non-reasoning";

test("contract fixtures validate; the link payload decodes; broken payloads import nothing", () => {
	for (const name of ["grill-delivery", "minimal"]) {
		const doc = fixture(name);
		assert.deepEqual(collectionIssues(doc), [], name);
		assert.ok(isCollectionDoc(doc));
		const parsed = decodeCollectionParam(b64url(JSON.stringify(doc)));
		assert.ok(parsed.ok, name);
	}
	assert.equal(decodeCollectionParam("%%%").ok, false);
	const bad = decodeCollectionParam(b64url("{not json"));
	assert.equal(!bad.ok && bad.code, "collection_json");
	const big = decodeCollectionParam(b64url(" ".repeat(COLLECTION_MAX_BYTES + 1)));
	assert.equal(!big.ok && big.code, "collection_too_large");
	const doc = fixture("grill-delivery");
	const schema = parseCollection({ ...doc, items: [{ kind: "block", id: "hero" }] });
	assert.equal(!schema.ok && schema.code, "collection_schema");
	const empty = parseCollection({ ...doc, items: [] });
	assert.equal(!empty.ok && empty.code, "collection_program");
	assert.deepEqual(!empty.ok && empty.issues.map((i) => i.keyword), ["empty_collection"]);
	const dup = parseCollection({ ...doc, items: [doc.items[1], doc.items[1]] });
	assert.deepEqual(!dup.ok && dup.issues.map((i) => i.keyword), ["duplicate_item"]);
	// Non-ASCII titles survive the UTF-8 round trip.
	const titled = decodeCollectionParam(b64url(JSON.stringify({ ...doc, title: "K\u00fcche \u00e0 la carte" })));
	assert.equal(titled.ok && titled.doc.title, "K\u00fcche \u00e0 la carte");
});

test("?collection= is read once and removed; path (/ or /build), other params and hash are kept", () => {
	assert.deepEqual(splitCollectionParam("https://buildychat.vercel.app/?collection=abc"), { payload: "abc", next: "/" });
	assert.deepEqual(splitCollectionParam("https://x.test/build?session=s1&collection=abc#top"), { payload: "abc", next: "/build?session=s1#top" });
	assert.deepEqual(splitCollectionParam("https://x.test/?session=s1"), { payload: null, next: "/?session=s1" });
	assert.equal(splitCollectionParam("https://x.test/?collection=").payload, null);
});

test("split against the pinned snapshot keeps order and never substitutes", () => {
	const doc = fixture("grill-delivery");
	const items = [...doc.items, { kind: "block" as const, id: "block.hero", variant: "nosuchvariant" }, { kind: "screen" as const, id: "screen.nosuch/home" }];
	const { present, missing } = splitCollection(items);
	assert.deepEqual(missing.map((i) => `${i.id}${"variant" in i && i.variant ? `/${i.variant}` : ""}`), ["block.hero/nosuchvariant", "screen.nosuch/home"]);
	assert.equal(present.length, doc.items.length);
	assert.equal(doc.pins.stock.assetsDigest, snapshotDigest());
});

test("session 1.3.0: a chat carries its collection (items + missing); a bad item is rejected", () => {
	const doc = fixture("grill-delivery");
	const chat = { id: "session-1", title: doc.title, updatedAt: "2026-11-11T10:00:00.000Z", messages: [], collection: { id: doc.id, title: doc.title, importedAt: "2026-11-11T10:00:00.000Z", assetsDigest: doc.pins.stock.assetsDigest, items: doc.items, missing: [] } };
	assert.deepEqual(sessionDefIssues(chat, "session"), []);
	const bad = { ...chat, collection: { ...chat.collection, items: [{ kind: "block", id: "nope" }] } };
	assert.notDeepEqual(sessionDefIssues(bad, "session"), []);
});

const ITEMS = [
	{ kind: "block", id: "block.hero", variant: "split" },
	{ kind: "block", id: "block.cta" },
	{ kind: "block", id: "block.about", variant: "split" },
	{ kind: "block", id: "block.nosuch" }
];

test("bounds: block items are required and allowed, screen items allow their blocks, missing items are dropped", () => {
	const bounds = collectionBounds({ id: "c1", title: "Shelf", items: [...ITEMS, { kind: "screen", id: SCREEN, note: "order of the page" }] })!;
	assert.deepEqual(bounds.required.map((r) => [r.catalogBlock, r.variant, r.kind]), [["block.hero", "split", "hero"], ["block.cta", null, "cta"], ["block.about", "split", null]]);
	for (const spec of ["block.header", "block.hero", "block.features", "block.cta", "block.footer", "block.about"]) assert.ok(bounds.allowed.includes(spec), spec);
	assert.ok(!bounds.allowed.includes("block.nosuch"));
	assert.deepEqual(bounds.screens, [SCREEN]);
	assert.deepEqual(bounds.notes, [{ id: SCREEN, note: "order of the page" }]);
	assert.equal(collectionBounds({ id: "c", title: "t", items: [{ kind: "block", id: "block.nosuch" }] }), null);
	assert.equal(collectionBounds(null), null);
	const prompt = collectionPromptContext(bounds);
	assert.deepEqual(prompt.screens, [SCREEN]);
	const mapped = mapChatRunRequest({ modelId: MODEL, brief: "x", collection: { id: "c1", title: "Shelf", items: ITEMS } }, { discoveredChatIds: [MODEL] });
	assert.ok(mapped.ok && mapped.request.collection?.required.length === 3);
});

const bounds = collectionBounds({ id: "c1", title: "Shelf", items: ITEMS })!;
const HOST = { liveTurn: true, mode: "build" as const, collection: bounds };
const propose = (args: Record<string, unknown>, host: Record<string, unknown> = HOST) =>
	executeTool({ name: "propose_layout", arguments: { brief: "bakery", screenId: SCREEN, locale: "en", ...args } }, host);
const used = (r: ReturnType<typeof executeTool>) =>
	r.ok ? (r.result as { page: { layout: { blocks: Array<{ kind: string; catalogBlock?: string; variant?: string }> } } }).page.layout.blocks.map((b) => `${b.catalogBlock}/${b.variant}`) : [];

test("propose_layout outside the collection: outside_collection with the allowed list and every unused item", () => {
	const r = propose({});
	assert.equal(r.ok, false);
	if (r.ok) return;
	assert.equal(r.code, "outside_collection");
	assert.equal(r.path, "collection");
	const fix = r.result as { allowedCatalogBlocks: string[]; outside: Array<{ catalogBlock: string }>; unused: Array<{ catalogBlock: string; variant: string | null }> };
	assert.deepEqual(fix.allowedCatalogBlocks, bounds.allowed);
	assert.deepEqual(fix.outside.map((o) => o.catalogBlock), ["block.header", "block.features", "block.footer"]);
	assert.deepEqual(fix.unused.map((u) => `${u.catalogBlock}/${u.variant}`), ["block.hero/split"]);
});

test("the model's fix (required entries, remove for kinds outside) is accepted; items without a renderer are said", () => {
	const r = propose({ remove: ["nav", "features", "footer"], blocks: [{ kind: "hero", catalogBlock: "block.hero", variant: "split", title: "Fresh bread" }, { kind: "cta", catalogBlock: "block.cta" }] });
	assert.ok(r.ok, JSON.stringify(r));
	assert.deepEqual(used(r), ["block.hero/split", "block.cta/card"]);
	const warnings = (r.result as { warnings: string[] }).warnings;
	assert.ok(warnings.some((w) => w.includes("block.about/split") && /no page renderer/.test(w)));
});

test("collection_item_unused alone; repairCollectionArgs places the item; prune drops outside blocks", () => {
	const r = propose({ remove: ["nav", "features", "footer"] });
	assert.equal(!r.ok && r.code, "collection_item_unused");
	if (r.ok) return;
	const repair = repairCollectionArgs({ remove: ["nav", "features", "footer"] }, r);
	assert.ok(repair);
	assert.deepEqual(used(propose(repair!.args)), ["block.hero/split", "block.cta/card"]);
	// The model's own entry of that kind (no catalogBlock) gets the item; its copy stays (the parser keeps one entry per kind).
	const own = { remove: ["nav", "features", "footer"], blocks: [{ kind: "hero", title: "Fresh bread" }, { kind: "cta", catalogBlock: "block.cta", variant: "card" }] };
	const ownReject = propose(own);
	assert.equal(!ownReject.ok && ownReject.code, "collection_item_unused");
	const ownRepair = repairCollectionArgs(own, ownReject as { code: string; result?: unknown });
	assert.equal((ownRepair!.args.blocks as unknown[]).length, 2);
	assert.deepEqual(used(propose(ownRepair!.args)), ["block.hero/split", "block.cta/card"]);
	const pruned = propose({}, { ...HOST, collection: { ...bounds, prune: true } });
	assert.deepEqual(used(pruned), ["block.hero/centered", "block.cta/card"]);
	assert.ok((pruned.ok ? (pruned.result as { warnings: string[] }).warnings : []).some((w) => /block\.header \(nav\) is not in the collection/.test(w)));
});

type Scripted = { calls: Array<{ name: string; arguments: Record<string, unknown> }> };

async function withProvider<T>(script: Scripted[], run: (requests: Array<Record<string, unknown>>) => Promise<T>): Promise<T> {
	const original = globalThis.fetch;
	const requests: Array<Record<string, unknown>> = [];
	let index = 0;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		if (!String(input).includes("/chat/completions")) {
			return new Response(JSON.stringify({ data: [{ id: MODEL }] }), { status: 200, headers: { "content-type": "application/json" } });
		}
		requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
		const step = script[Math.min(index, script.length - 1)]!;
		index += 1;
		const message = {
			role: "assistant",
			content: null,
			tool_calls: step.calls.map((call, i) => ({ id: `c-${index}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } }))
		};
		return new Response(JSON.stringify({ model: MODEL, choices: [{ message, finish_reason: "tool_calls" }], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 } }), {
			status: 200,
			headers: { "content-type": "application/json" }
		});
	}) as typeof fetch;
	try {
		return await run(requests);
	} finally {
		globalThis.fetch = original;
	}
}

const CTX = { brief: "Bakery landing", mode: "build" as const, scenarioId: null, screenId: SCREEN, expectedRevision: 0, collection: bounds };
const outside = { name: "propose_layout", arguments: { screenId: SCREEN, locale: "en" } };

const body = (request: Record<string, unknown>) => request.messages as Array<{ role: string; content?: string }>;
const specsOf = (proposal: unknown) =>
	(proposal as { page: { layout: { blocks: Array<{ catalogBlock?: string; variant?: string }> } } }).page.layout.blocks.map((b) => `${b.catalogBlock}/${b.variant}`);

test("intake draft: the host places the collection before the model (screen, required items, removed kinds, variants)", () => {
	const draft = collectionIntakeDraft({ bounds, brief: "Bakery landing", screenId: SCREEN })!;
	assert.ok(draft);
	assert.equal(draft.screenId, SCREEN);
	assert.deepEqual(draft.blocks.map((row) => `${row.catalogBlock}/${row.variant}`), ["block.hero/split", "block.cta/card"]);
	assert.deepEqual(draft.remove.sort(), ["features", "footer", "nav"]);
	const hero = draft.blocks.find((row) => row.kind === "hero")!;
	assert.equal(hero.required, true);
	assert.deepEqual(hero.variants, catalogVariantsFor("block.hero"));
	assert.ok(hero.defaultVariant && hero.variants.includes(hero.defaultVariant));
	assert.ok(draft.warnings.some((w) => /block\.about\/split/.test(w)));
	// Pre-placement: a bare model call gets the draft screen, blocks and removed kinds; copy and allowed choices stay.
	const placed = placeCollectionDraft({ locale: "en", blocks: [{ kind: "hero", title: "Fresh bread" }, { kind: "cta", variant: "banner" }] }, draft, bounds);
	assert.equal(placed.screenId, SCREEN);
	assert.deepEqual(placed.blocks, [
		{ kind: "hero", title: "Fresh bread", catalogBlock: "block.hero", variant: "split" },
		{ kind: "cta", variant: "banner", catalogBlock: "block.cta" }
	]);
	assert.deepEqual((placed.remove as string[]).sort(), ["features", "footer", "nav"]);
	// A screen-only collection: every block of the screen is allowed, nothing is removed.
	const screenOnly = collectionBounds({ id: "c2", title: "Site", items: [{ kind: "screen", id: SCREEN }] })!;
	const whole = collectionIntakeDraft({ bounds: screenOnly, brief: "site" })!;
	assert.equal(whole.screenId, SCREEN);
	assert.deepEqual(whole.remove, []);
	assert.ok(whole.blocks.every((row) => screenOnly.allowed.includes(row.catalogBlock)));
});

test("intake turn: one model step, compact prompt (draft, collection blocks only, one tool), page only from the collection", async () => {
	await withProvider([{ calls: [outside] }], async (requests) => {
		const turn = await runXaiCatalogTurn("test-key", MODEL, CTX, AbortSignal.timeout(5000));
		assert.ok(turn.proposal.ok && "page" in turn.proposal, JSON.stringify(turn.proposal));
		assert.equal(requests.length, 1);
		assert.equal(turn.meta.steps, 1);
		assert.deepEqual(specsOf(turn.proposal), ["block.hero/split", "block.cta/card"]);
		const user = JSON.parse(String(body(requests[0]!)[1]!.content));
		assert.equal(user.draft.screenId, SCREEN);
		assert.deepEqual(Object.keys(user.catalogSources.blocks).sort(), ["block.cta", "block.hero"]);
		assert.equal(user.catalogVocabulary, undefined);
		assert.deepEqual((requests[0]!.tools as Array<{ function: { name: string } }>).map((tool) => tool.function.name), ["propose_layout"]);
		// The same author message without a collection: the ordinary Build prompt is several times larger.
		await withProvider([{ calls: [{ name: "propose_layout", arguments: { screenId: SCREEN, locale: "en" } }] }], async (plain) => {
			await runXaiCatalogTurn("test-key", MODEL, { ...CTX, collection: null }, AbortSignal.timeout(5000));
			const size = (r: Record<string, unknown>) => JSON.stringify({ messages: r.messages, tools: r.tools }).length;
			assert.ok(size(requests[0]!) * 2.5 < size(plain[0]!), `${size(requests[0]!)} vs ${size(plain[0]!)}`);
		});
	});
});

test("intake turn: a block outside the collection is repaired by the host at once (no second model step)", async () => {
	const other = Object.entries((modelCatalogSources() as { blocks: Record<string, { kind: string }> }).blocks).find(([spec, row]) => row.kind === "hero" && !bounds.allowed.includes(spec))![0];
	const call = { name: "propose_layout", arguments: { screenId: SCREEN, locale: "en", blocks: [{ kind: "hero", catalogBlock: other, title: "Fresh bread" }] } };
	await withProvider([{ calls: [call] }, { calls: [call] }], async (requests) => {
		const turn = await runXaiCatalogTurn("test-key", MODEL, CTX, AbortSignal.timeout(5000));
		assert.ok(turn.proposal.ok && "page" in turn.proposal, JSON.stringify(turn.proposal));
		assert.equal(requests.length, 1);
		const specs = specsOf(turn.proposal);
		assert.ok(specs.every((spec) => bounds.allowed.includes(spec.split("/")[0]!)), specs.join());
		assert.ok(specs.includes("block.hero/split"));
		assert.ok(turn.proposal.warnings.some((w) => /is not in the collection "Shelf"; the hero block stays block\.hero\/split/.test(w)));
	});
});

test("intake turn: an invalid variant comes back with the allowed list; the same again uses the catalog default (said)", async () => {
	const bad = { name: "propose_layout", arguments: { screenId: SCREEN, locale: "en", blocks: [{ kind: "cta", catalogBlock: "block.cta", variant: "nosuch" }] } };
	await withProvider([{ calls: [bad] }, { calls: [bad] }], async (requests) => {
		const turn = await runXaiCatalogTurn("test-key", MODEL, CTX, AbortSignal.timeout(5000));
		assert.ok(turn.proposal.ok && "page" in turn.proposal, JSON.stringify(turn.proposal));
		assert.equal(requests.length, 2);
		const reply = JSON.parse(body(requests[1]!).filter((m) => m.role === "tool").at(-1)!.content!);
		assert.equal(reply.code, "unknown_variant");
		assert.deepEqual(reply.fix.allowedVariants, catalogVariantsFor("block.cta"));
		assert.equal(reply.budget.maxSteps, 3);
		assert.deepEqual(specsOf(turn.proposal), ["block.hero/split", "block.cta/card"]);
		assert.ok(turn.proposal.warnings.some((w) => /nosuch/.test(w)));
	});
});

test("intake turn: an invalid variant on a required item never leaves the turn stuck; the author's variant is placed", async () => {
	const bad = { name: "propose_layout", arguments: { screenId: SCREEN, locale: "en", blocks: [{ kind: "hero", catalogBlock: "block.hero", variant: "nosuch" }] } };
	await withProvider([{ calls: [bad] }], async (requests) => {
		const turn = await runXaiCatalogTurn("test-key", MODEL, CTX, AbortSignal.timeout(5000));
		assert.ok(turn.proposal.ok && "page" in turn.proposal, JSON.stringify(turn.proposal));
		assert.ok(requests.length <= 3);
		assert.deepEqual(specsOf(turn.proposal), ["block.hero/split", "block.cta/card"]);
	});
});

test("intake turn: a text-only answer creates no proposal", async () => {
	await withProvider([{ calls: [] }], async (requests) => {
		const turn = await runXaiCatalogTurn("test-key", MODEL, CTX, AbortSignal.timeout(5000));
		assert.equal(requests.length, 1);
		assert.equal("page" in turn.proposal, false);
	});
});

test("collection chat with a current page: the ordinary edit loop, catalog sources limited to the collection", async () => {
	const made = executeTool({ name: "propose_layout", arguments: { brief: "bakery", screenId: SCREEN, locale: "en", remove: ["nav", "features", "footer"], blocks: [{ kind: "hero", catalogBlock: "block.hero", variant: "split" }] } }, HOST);
	assert.ok(made.ok);
	const page = (made.result as { page: Record<string, unknown> }).page;
	await withProvider([{ calls: [] }], async (requests) => {
		await runXaiCatalogTurn("test-key", MODEL, { ...CTX, currentPage: page as never, expectedRevision: 1 }, AbortSignal.timeout(5000));
		const user = JSON.parse(String(body(requests[0]!)[1]!.content));
		assert.equal(user.draft, undefined);
		assert.deepEqual(Object.keys(user.catalogSources.blocks).sort(), bounds.allowed.filter((spec) => spec !== "block.about").sort());
	});
});

test("intake draft: a collection whose screen cannot render yet gets a renderable screen with only its blocks (said)", () => {
	const doc = fixture("grill-delivery");
	const grill = collectionBounds(doc)!;
	const draft = collectionIntakeDraft({ bounds: grill, brief: "grill promo" })!;
	assert.ok(draft, "never stuck: a draft exists");
	assert.notEqual(draft.screenId, "screen.theme-food-grill/home");
	assert.ok(draft.blocks.every((row) => grill.allowed.includes(row.catalogBlock)));
	assert.ok(draft.blocks.some((row) => row.catalogBlock === "block.hero" && row.variant === "centered" && row.required));
	assert.match(draft.warnings[0]!, /screen\.theme-food-grill\/home cannot render in this BuildY version yet/);
});

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
	collectionPromptContext,
	executeTool,
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

test("live loop: the collection reaches the model; the same page twice is repaired by the host (prune, items placed)", async () => {
	await withProvider([{ calls: [outside] }, { calls: [outside] }], async (requests) => {
		const turn = await runXaiCatalogTurn("test-key", MODEL, CTX, AbortSignal.timeout(5000));
		assert.ok(turn.proposal.ok, JSON.stringify(turn.proposal));
		assert.equal(requests.length, 2);
		const user = JSON.parse(String((requests[0]!.messages as Array<{ role: string; content: string }>)[1]!.content));
		assert.deepEqual(user.collection.allowedCatalogBlocks, bounds.allowed);
		const tool = (requests[1]!.messages as Array<{ role: string; content?: string }>).filter((m) => m.role === "tool").at(-1);
		const reply = JSON.parse(tool!.content!);
		assert.equal(reply.code, "outside_collection");
		assert.deepEqual(reply.fix.allowedCatalogBlocks, bounds.allowed);
		if (!turn.proposal.ok || !("page" in turn.proposal)) return;
		const specs = turn.proposal.page.layout.blocks.map((b) => `${b.catalogBlock}/${b.variant}`);
		assert.deepEqual(specs, ["block.hero/split", "block.cta/card"]);
		assert.ok(turn.proposal.warnings.some((w) => /placed by the host: block\.hero\/split/.test(w)));
	});
});

test("live loop: a fixed page on the second call is accepted as the model sent it", async () => {
	const fixed = { name: "propose_layout", arguments: { screenId: SCREEN, locale: "en", remove: ["nav", "features", "footer"], blocks: [{ kind: "hero", catalogBlock: "block.hero", variant: "split" }] } };
	await withProvider([{ calls: [outside] }, { calls: [fixed] }], async () => {
		const turn = await runXaiCatalogTurn("test-key", MODEL, CTX, AbortSignal.timeout(5000));
		assert.ok(turn.proposal.ok && "page" in turn.proposal);
		if (!turn.proposal.ok || !("page" in turn.proposal)) return;
		assert.deepEqual(turn.proposal.page.layout.blocks.map((b) => b.catalogBlock), ["block.hero", "block.cta"]);
		assert.ok(!turn.proposal.warnings.some((w) => /placed by the host/.test(w)));
	});
});

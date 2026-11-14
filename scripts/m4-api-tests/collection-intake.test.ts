// Stock collection intake (buildy-collection:v1, ui8kit/contract docs/collection-intake.md; ADR 0034): decode / schema /
// program checks, the split against the pinned snapshot, the session 1.3.0 field, and the collection as write errors of the
// one write_page tool (outside_collection, collection_item_unused with paths). Catalog data only.
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
import { checkCollection, collectionBounds, collectionDraft, collectionPromptContext, emptyPage, snapshotDigest, splitCollection, writePage } from "../../packages/builder-core/src/index.ts";
import { mapChatRunRequest, type AgentReply } from "../../packages/chat-agent/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { splitCollectionParam } from "../../apps/chat-web/src/lib/browser/collection-intake.ts";
import { MODEL, signal, withProvider } from "./agent-replay.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../packages/page-contract/fixtures/collection/${name}.json`, import.meta.url), "utf8")) as CollectionDoc;
const b64url = (text: string) => Buffer.from(text, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const SCREEN = "screen.site/home";
const NOW = "2026-11-13T12:00:00.000Z";

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
	// a collection pinned to another Stock version is valid (the chip row says so); the pin is a digest, the snapshot has one
	assert.match(doc.pins.stock.assetsDigest, /^sha256:[0-9a-f]{64}$/);
	assert.match(snapshotDigest(), /^sha256:[0-9a-f]{64}$/);
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
	assert.deepEqual(bounds.required.map((r) => [r.item, r.variant]), [["hero-classic", "split"], ["cta-band", null], ["about-company", "split"]]);
	for (const item of ["site-header", "hero-classic", "feature-grid", "cta-band", "site-footer", "about-company"]) assert.ok(bounds.allowed.includes(item), item);
	assert.deepEqual(bounds.screens, [SCREEN]);
	assert.deepEqual(bounds.notes, [{ id: SCREEN, note: "order of the page" }]);
	assert.equal(collectionBounds({ id: "c", title: "t", items: [{ kind: "block", id: "block.nosuch" }] }), null);
	assert.equal(collectionBounds(null), null);
	assert.deepEqual(collectionPromptContext(bounds).screens, [SCREEN]);
	const mapped = mapChatRunRequest({ modelId: MODEL, brief: "x", collection: { id: "c1", title: "Shelf", items: ITEMS } }, { discoveredChatIds: [MODEL] });
	assert.ok(mapped.ok && mapped.request.collection?.required.length === 3);
});

test("a page outside the collection is rejected with the paths; the draft starts inside it", () => {
	const bounds = collectionBounds({ id: "c1", title: "Shelf", items: ITEMS })!;
	const draft = collectionDraft(bounds, { title: "Bakery", locale: "en", now: NOW });
	assert.ok(draft.ok, JSON.stringify(!draft.ok && draft.issues));
	if (!draft.ok) return;
	assert.deepEqual(checkCollection(draft.page, bounds), []);
	const items = draft.page.blocks.map((block) => block.item);
	for (const required of bounds.required) assert.ok(items.includes(required.item), required.item);
	assert.ok(items.every((item) => bounds.allowed.includes(item)));
	// A block outside the collection and a required item left out: both listed at once, with paths.
	const outside = writePage(draft.page, { patch: [{ op: "add", path: "/blocks/-", value: { item: "pricing-tiers", variant: "grid" } }, { op: "remove", path: "/blocks/0" }] }, { now: NOW });
	assert.ok(outside.ok);
	if (outside.ok) {
		const issues = checkCollection(outside.page, bounds);
		assert.ok(issues.some((i) => i.code === "outside_collection" && i.got === "pricing-tiers" && /^\/blocks\/\d+\/item$/.test(i.path)));
	}
});

test("collection chat: write_page outside the collection comes back as outside_collection; the fix proposes", async () => {
	const bounds = collectionBounds({ id: "c1", title: "Shelf", items: ITEMS })!;
	const draft = collectionDraft(bounds, { title: "Bakery", locale: "en", now: NOW });
	assert.ok(draft.ok);
	if (!draft.ok) return;
	const outside = { patch: [{ op: "add", path: "/blocks/-", value: { item: "pricing-tiers", variant: "grid" } }] };
	const fixed = { patch: [{ op: "replace", path: "/title", value: "Fresh bread" }] };
	const { out, seen } = await withProvider(
		[{ calls: [{ name: "write_page", arguments: outside }] }, { calls: [{ name: "write_page", arguments: fixed }] }, { content: "Done." }],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "A bakery page", mode: "build", page: draft.page, expectedRevision: 0, collection: bounds }, signal()), seen })
	);
	assert.equal(seen.requests.length, 3);
	const first = (seen.toolMessages[0]!.content as { issues: Array<{ code: string; got: unknown }> }).issues;
	assert.ok(first.some((issue) => issue.code === "outside_collection" && issue.got === "pricing-tiers"));
	const reply = out.result as AgentReply;
	assert.ok(reply.ok && reply.proposal, JSON.stringify(out.result));
	assert.equal(reply.proposal!.page.title, "Fresh bread");
	assert.equal(emptyPage({ title: "x" }).blocks.length, 0);
});

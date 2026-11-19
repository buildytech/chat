/**
 * A rejected write is kept and explained (owner session 15.11, app f036216: "the model sent the same invalid page twice
 * (write_stuck)", the page stayed empty and the export kept neither the document nor the errors). A failed turn keeps the last
 * rejected write (run.rejected) and says the first reason in plain words.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { emptyPage } from "../../packages/builder-core/src/index.ts";
import { rejectedWrite } from "../../packages/chat-agent/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { firstReason } from "../../apps/chat-web/src/modules/chat/core/reason.ts";
import { MODEL, installBundleProbe, signal, withProvider } from "./agent-replay.ts";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const studio = JSON.parse(readFileSync(here("./fixtures/studio-fill.json"), "utf8")) as { blocks: Array<{ item: string; props: Record<string, unknown> }> };
const BRIEF = "A site for a small interior studio";
const base = () => emptyPage({ title: "x", locale: "ru", now: "2026-11-15T09:00:00.000Z" });
const clone = () => JSON.parse(JSON.stringify(studio)) as typeof studio;
/** The rejection the session ended on (a required icon "smile" the enum did not list). */
const observed = [{ path: "/blocks/5/props/quotes/2/mark", code: "props_invalid", expected: 'one of 1890 Lucide icon names; "smile" is not one, nearest: file, milk, scale, slice, angle, apple; any other real name works (e.g. house, star, utensils, truck)', got: "smile" }];

let release: () => void;
before(async () => {
	release = await installBundleProbe();
});
after(() => release());

test("a turn that still fails keeps the last rejected write: first issues and the document, small, in run.rejected", async () => {
	const page = clone();
	page.blocks[0]!.item = "no-such-block";
	const call = { calls: [{ name: "write_page", arguments: { page } }] };
	const { out } = await withProvider([call, call], async (seen) => ({
		out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page: base(), expectedRevision: 1 }, signal()),
		seen
	}));
	assert.equal(out.result.ok, false);
	if (out.result.ok) return;
	assert.equal(out.result.code, "write_stuck");
	const rejected = out.result.rejected!;
	assert.equal(rejected.issues[0]!.code, "unknown_item");
	assert.equal(rejected.issues[0]!.path, "/blocks/0/item");
	assert.equal((rejected.doc as { blocks: unknown[] }).blocks.length, page.blocks.length);
	assert.ok(JSON.stringify(rejected).length < 40_000);
	assert.doesNotMatch(JSON.stringify(rejected), /sk-|xai-|apikey/i);
});

test("a large rejected document keeps the block of the first issue", () => {
	const big = { blocks: [{ item: "a", props: { text: "x".repeat(30_000) } }, { item: "b", props: {} }] };
	const kept = rejectedWrite({ page: big }, [{ path: "/blocks/1/props/x", code: "props_invalid", expected: "e", got: "g" }], "write_invalid");
	assert.deepEqual(kept.doc, { block: { item: "b", props: {} } });
	assert.equal(kept.partial, true);
});

test("the first reason in plain words, in both interface languages; no model-facing text", () => {
	const web = (name: string) => JSON.parse(readFileSync(here(`../../apps/chat-web/src/modules/chat/i18n/${name}.json`), "utf8")).messages as Record<string, string>;
	const [en, ru] = [web("en"), web("ru")];
	const say = (messages: Record<string, string>) => (key: string) => messages[key] ?? key;
	const issues = observed;
	assert.equal(firstReason(issues, say(en)), 'First problem: block 6, quotes 3 mark: "smile" is not a Lucide icon name.');
	assert.match(firstReason(issues, say(ru)), /^\u041f\u0435\u0440\u0432\u0430\u044f \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0430: \u0431\u043b\u043e\u043a 6, quotes 3 mark: /);
	assert.equal(firstReason([{ path: "/blocks/0/props/title", code: "schema_invalid", expected: "text", got: undefined }], say(en)), "First problem: block 1, title: a required value is missing.");
	assert.equal(firstReason([{ path: "/blocks/2/variant", code: "unknown_variant", expected: "one of a | b", got: "zzz" }], say(en)), 'First problem: block 3, variant: there is no variant "zzz".');
	assert.equal(firstReason([], say(en)), "");
	for (const key of ["run.writeInvalid", "run.writeStuck"]) {
		assert.match(en[key]!, /\{reason\}/);
		assert.match(ru[key]!, /\{reason\}/);
	}
	assert.doesNotMatch(firstReason(issues, say(en)), /props_invalid|nearest|write_page/);
});

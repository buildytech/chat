/**
 * Owner session 15.11 (app f036216, Build, "birthday site for my brother Nikita, replace the placeholders with stock photos"):
 * "The page was not written: the model sent the same invalid page twice (write_stuck)", the page stayed empty. The export kept
 * neither the document nor the errors; a headless run of the same prompt (fixtures/birthday-write-stuck-f036216.json) shows the
 * cause: the model wrote the icon "smile" at /blocks/5/props/quotes/2/mark (a required icon). Lucide 1.x renamed it to
 * face-slightly-smiling (smile is an alias), the registry enum lists canonical names only, so the gate rejected the write, and the
 * model sent the same page again. Fixes: old Lucide names map to the published name (generated lucide-aliases.json); an unknown
 * icon no longer fails a page (dropped when optional, the sample icon when required, both noted); a failed turn keeps the last
 * rejected write (run.rejected) and says the first reason in plain words.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { emptyPage, lucideIcons, resolveIconName, writePage } from "../../packages/builder-core/src/index.ts";
import { rejectedWrite } from "../../packages/chat-agent/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { firstReason } from "../../apps/chat-web/src/modules/chat/core/reason.ts";
import { MODEL, installBundleProbe, signal, withProvider } from "./agent-replay.ts";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const fixture = JSON.parse(readFileSync(here("./fixtures/birthday-write-stuck-f036216.json"), "utf8")) as {
	brief: string;
	observed: { code: string; issues: Array<{ path: string; code: string; expected: string; got: unknown }> };
	page: { blocks: Array<{ item: string; props: Record<string, unknown> }> };
};
const MARK = "/blocks/5/props/quotes/2/mark";
const base = () => emptyPage({ title: "x", locale: "ru", now: "2026-11-15T09:00:00.000Z" });
const clone = () => JSON.parse(JSON.stringify(fixture.page)) as typeof fixture.page;
const quote = (page: typeof fixture.page) => (page.blocks[5]!.props.quotes as Array<Record<string, unknown>>)[2]!;

let release: () => void;
before(async () => {
	release = await installBundleProbe();
});
after(() => release());

test("the session: write_stuck on one required icon, smile, which the enum does not list", () => {
	assert.equal(fixture.observed.code, "write_stuck");
	assert.deepEqual(fixture.observed.issues.map((i) => [i.path, i.got]), [[MARK, "smile"]]);
	assert.equal(fixture.page.blocks[5]!.item, "testimonial-grid");
	assert.equal(quote(fixture.page).mark, "smile");
	assert.ok(!lucideIcons().includes("smile"));
});

test("old Lucide names map to the published name; a name Lucide never had does not", () => {
	assert.equal(resolveIconName("smile"), "face-slightly-smiling");
	assert.equal(resolveIconName("home"), "house");
	assert.equal(resolveIconName("check-circle"), "circle-check-big");
	assert.equal(resolveIconName("Smile"), "face-slightly-smiling");
	assert.equal(resolveIconName("no-such-icon-xyz"), null);
});

test("the document the model sent twice is written; smile becomes face-slightly-smiling, noted", () => {
	const written = writePage(base(), { page: fixture.page });
	assert.ok(written.ok, JSON.stringify(!written.ok && written.issues));
	if (!written.ok) return;
	assert.equal(quote(written.page as unknown as typeof fixture.page).mark, "face-slightly-smiling");
	assert.ok(written.warnings.some((w) => w.startsWith(`${MARK}: icon "smile" written as "face-slightly-smiling"`)), JSON.stringify(written.warnings));
});

test("an icon Lucide does not have: a required one takes the sample icon, an optional one is dropped; the page is written", () => {
	const page = clone();
	quote(page).mark = "no-such-icon-xyz";
	const written = writePage(base(), { page });
	assert.ok(written.ok, JSON.stringify(!written.ok && written.issues));
	if (!written.ok) return;
	const mark = quote(written.page as unknown as typeof fixture.page).mark;
	assert.ok(typeof mark === "string" && lucideIcons().includes(mark), String(mark));
	assert.ok(written.warnings.some((w) => w.startsWith(`${MARK}: icon "no-such-icon-xyz" is not a Lucide icon; the sample icon`)), JSON.stringify(written.warnings));
	// an optional icon (announcement-bar /icon): dropped, noted
	const optional = writePage(base(), { page: { ...base(), blocks: [{ item: "announcement-bar", props: { icon: "no-such-icon-xyz" } }] } });
	assert.ok(optional.ok, JSON.stringify(!optional.ok && optional.issues));
	if (!optional.ok) return;
	assert.ok(!("icon" in (optional.page.blocks[0]!.props as Record<string, unknown>)));
	assert.ok(optional.warnings.some((w) => /\/blocks\/0\/props\/icon: icon "no-such-icon-xyz" is not a Lucide icon; dropped/.test(w)), JSON.stringify(optional.warnings));
});

test("replay: the first write is accepted and ends the turn (before the fix: the same rejection twice, write_stuck)", async () => {
	const call = { calls: [{ name: "write_page", arguments: { page: fixture.page } }] };
	const { out, seen } = await withProvider([call, call, { content: "Never asked for." }], async (seen) => ({
		out: await runXaiCatalogTurn("k", MODEL, { brief: fixture.brief, mode: "build", page: base(), expectedRevision: 1 }, signal()),
		seen
	}));
	assert.equal(seen.requests.length, 1);
	assert.ok(out.result.ok && out.result.proposal);
});

test("a turn that still fails keeps the last rejected write: first issues and the document, small, in run.rejected", async () => {
	const page = clone();
	page.blocks[0]!.item = "no-such-block";
	const call = { calls: [{ name: "write_page", arguments: { page } }] };
	const { out } = await withProvider([call, call], async (seen) => ({
		out: await runXaiCatalogTurn("k", MODEL, { brief: fixture.brief, mode: "build", page: base(), expectedRevision: 1 }, signal()),
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
	const issues = fixture.observed.issues;
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

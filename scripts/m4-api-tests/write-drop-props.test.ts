/**
 * Owner session "Shashlyk Mashlyk" (landing for a delivery promotion): the model's write at /blocks/2/props/dishes/0/currency
 * was rejected (path_not_found) after four writes, and the chat showed the model-facing text "The page was not written: ...
 * call write_page again". Minimal fixes: (1) props the schema does not have are dropped by write_page with a short note, real
 * errors still reject (and an empty list says how to add a row); (2) a turn without an accepted write shows the localized
 * status (ru: page not changed / en: "No changes were made to the page.") with a short reason; (3) the prompt names the
 * currency as an ISO code (RUB), never the symbol.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { addScreen, applyOp, emptyPage, writePage } from "../../packages/builder-core/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import { MODEL, signal, withProvider, type Scripted } from "./agent-replay.ts";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const session = JSON.parse(readFileSync(here("./fixtures/shashlyk-session.json"), "utf8")) as { sessions: Array<{ messages: Array<{ role: string; text: string; run?: { tools: string[] } }> }> };
const BRIEF = session.sessions[0]!.messages[0]!.text;
const BAD_TEXT = session.sessions[0]!.messages[1]!.text;
const ROW = { id: "d1", name: "\u0428\u0430\u0448\u043b\u044b\u043a \u0438\u0437 \u0441\u0432\u0438\u043d\u0438\u043d\u044b", summary: "\u0421 \u0434\u044b\u043c\u043a\u043e\u043c", price: 45000, currency: "RUB", weight: "300 \u0433", tag: "\u043c\u0430\u043d\u0433\u0430\u043b", items: ["\u0441\u0432\u0438\u043d\u0438\u043d\u0430"], minutes: 25 };

function pageWithDishes(): PageV2 {
	const start = addScreen(emptyPage({ title: "\u0428\u0430\u0448\u043b\u044b\u043a \u041c\u0430\u0448\u043b\u044b\u043a", locale: "ru", now: "2026-11-14T12:00:00.000Z" }), "screen.theme-marketing-landing/home");
	assert.ok(start.ok);
	const added = applyOp(start.page, { op: "add", item: "dish-showcase", at: 2 });
	assert.ok(added.ok);
	return added.page;
}
const dishesOf = (page: PageV2) => (page.blocks[2]!.props as { dishes: Array<Record<string, unknown>> }).dishes;

test("the session: the bad write ended a Build turn with the model-facing text as the answer", () => {
	assert.match(BRIEF, /\u0428\u0430\u0448\u043b\u044b\u043a \u041c\u0430\u0448\u043b\u044b\u043a/);
	assert.match(BAD_TEXT, /^The page was not written: 1 problem, first at \/blocks\/2\/props\/dishes\/0\/currency \(path_not_found\)/);
	assert.ok(session.sessions[0]!.messages[1]!.run!.tools.includes("write_page"));
});

test("a prop the schema does not have is dropped from a full write; the note lists the path; the rest is written", () => {
	const base = pageWithDishes();
	const next = structuredClone(base);
	(next.blocks[2]!.props as { dishes: unknown[] }).dishes = [{ ...ROW, spice: "hot" }];
	const out = writePage(base, { page: next });
	assert.ok(out.ok, JSON.stringify(out.ok ? "" : out.issues));
	if (!out.ok) return;
	assert.equal(out.changed, true);
	assert.deepEqual(Object.keys(dishesOf(out.page)[0]!).includes("spice"), false);
	assert.equal(dishesOf(out.page)[0]!.name, ROW.name);
	assert.deepEqual(out.warnings, ["Dropped (not in the props schema of the block): /blocks/2/props/dishes/0/spice."]);
});

test("a patch on a props path the schema does not have is dropped; the other operations apply", () => {
	const base = pageWithDishes();
	const out = writePage(base, { patch: [{ op: "replace", path: "/title", value: "\u0428\u0430\u0448\u043b\u044b\u043a \u041c\u0430\u0448\u043b\u044b\u043a: \u043c\u0430\u043d\u0433\u0430\u043b \u043d\u0430 \u0434\u043e\u043c" }, { op: "add", path: "/blocks/2/props/dishes/0/spice", value: "hot" }] });
	assert.ok(out.ok, JSON.stringify(out.ok ? "" : out.issues));
	if (!out.ok) return;
	assert.equal(out.page.title, "\u0428\u0430\u0448\u043b\u044b\u043a \u041c\u0430\u0448\u043b\u044b\u043a: \u043c\u0430\u043d\u0433\u0430\u043b \u043d\u0430 \u0434\u043e\u043c");
	assert.deepEqual(out.warnings, ["Dropped (not in the props schema of the block): /blocks/2/props/dishes/0/spice."]);
});

test("real errors still reject: a wrong type, a missing row", () => {
	const base = pageWithDishes();
	const wrongType = structuredClone(base);
	(wrongType.blocks[2]!.props as { dishes: unknown[] }).dishes = [{ ...ROW, price: "cheap" }];
	const typed = writePage(base, { page: wrongType });
	assert.equal(typed.ok, false);
	// currency is in the schema, but the list is empty: a real error, and it says how to add a row
	const missing = writePage(base, { patch: [{ op: "add", path: "/blocks/2/props/dishes/0/currency", value: "RUB" }] });
	assert.equal(missing.ok, false);
	if (!missing.ok) {
		assert.equal(missing.issues[0]!.code, "path_not_found");
		assert.match(missing.issues[0]!.expected, /the list is empty: add a whole row at its path with \/-/);
	}
});

test("the live turn: a write with an unknown prop is accepted, the model is told what was dropped, no error text", async () => {
	const base = pageWithDishes();
	const next = structuredClone(base);
	(next.blocks[2]!.props as { dishes: unknown[] }).dishes = [{ ...ROW, spice: "hot" }];
	const script: Scripted[] = [{ calls: [{ name: "write_page", arguments: { page: next } }] }, { content: "\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u0441\u043e\u0431\u0440\u0430\u043d\u0430." }];
	const { out, seen } = await withProvider(script, async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page: base, expectedRevision: 1 }, signal()), seen }));
	assert.ok(out.result.ok);
	if (!out.result.ok) return;
	assert.ok(out.result.proposal, "a proposal");
	const told = seen.toolMessages.find((m) => m.name === "write_page")!.content;
	assert.equal(told.ok, true);
	assert.deepEqual(told.notes, ["Dropped (not in the props schema of the block): /blocks/2/props/dishes/0/spice."]);
});

test("the prompt names the currency as an ISO code", async () => {
	const { seen } = await withProvider([{ content: "ok" }], async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "hi", mode: "ask", page: pageWithDishes(), expectedRevision: 1 }, signal()), seen }));
	const system = String((seen.requests[0]!.messages as Array<{ content: string }>)[0]!.content);
	assert.match(system, /currency is an ISO 4217 code \(RUB, USD, EUR\), never a symbol such as \u20bd or \$/);
});

test("a turn without an accepted write: localized status and reason, never the model-facing text", () => {
	const web = (path: string) => readFileSync(here(`../../apps/chat-web/src/modules/chat/${path}`), "utf8");
	const turn = web("core/turn.ts");
	for (const [code, key] of [["write_invalid", "run.writeInvalid"], ["write_stuck", "run.writeStuck"], ["no_answer", "run.noAnswer"]] as const) {
		assert.match(turn, new RegExp(`code === "${code}"\\) return t\\("${key.replace(".", "\\.")}"\\)`), `${code} -> ${key}`);
	}
	const en = JSON.parse(web("i18n/en.json")).messages as Record<string, string>;
	const ru = JSON.parse(web("i18n/ru.json")).messages as Record<string, string>;
	for (const key of ["run.writeInvalid", "run.writeStuck", "run.noAnswer"]) {
		assert.match(en[key]!, /^No changes were made to the page: .*\{code\}/, key);
		assert.match(ru[key]!, /^\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u043d\u0435 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0430: .*\{code\}/, key);
		assert.doesNotMatch(`${en[key]} ${ru[key]}`, /write_page|call write_page|Nothing changed/);
	}
});

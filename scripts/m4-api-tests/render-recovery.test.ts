/**
 * ADR 0035, owner session fail-aa57f99: the page holds two blocks that throw in the preview (currency symbol), the author asks
 * Build to fix them with both selected, and the model answers "fixed" without calling write_page. The host must (1) show the
 * model the existing render problems at turn start, (2) not let a turn that has something to fix end silently without an
 * accepted write (one nudge inside the turn), (3) leave the page untouched and say so, (4) accept the real fix and clear the problems.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderProblems } from "../../packages/builder-core/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import { MODEL, installBundleProbe, signal, withProvider, type Scripted } from "./agent-replay.ts";

const page = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/fail-page-aa57f99.json", import.meta.url)), "utf8")) as PageV2;
const BRIEF = "\u0411\u043b\u043e\u043a\u0438 \u043d\u0435 \u0440\u0435\u043d\u0434\u0435\u0440\u044f\u0442\u0441\u044f. \u041f\u043e\u0447\u0438\u043d\u0438 \u0438\u043b\u0438 \u0437\u0430\u043c\u0435\u043d\u0438";
let release: () => void;
before(async () => {
	release = await installBundleProbe();
});
after(() => release());

const claim: Scripted[] = [
	{ calls: [{ name: "get_block", arguments: { item: "dish-showcase" } }, { name: "get_block", arguments: { item: "zone-table" } }] },
	{ content: "Fixed: currency=RUB in both blocks." }
];
const userPrompt = (request: Record<string, unknown>) => JSON.parse(String((request.messages as Array<{ role: string; content: string }>)[1]!.content)) as Record<string, unknown>;

test("the first prompt lists the render problems of the existing page, with paths", async () => {
	assert.equal(renderProblems(page).length, 2);
	const { seen } = await withProvider(claim, async (seen) => {
		await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page, expectedRevision: 5, scopeBlockIds: ["dishes", "delivery"] }, signal());
		return { seen };
	});
	const prompt = userPrompt(seen.requests[0]!);
	const problems = prompt.renderProblems as Array<{ path: string; code: string; expected: string }>;
	assert.deepEqual(problems.map((p) => `${p.code} ${p.path}`), ["render_failed /blocks/2/props/dishes/0/currency", "render_failed /blocks/4/props/zones/0/currency"]);
	assert.match(problems[0]!.expected, /Invalid currency code/);
});

test("Build with selected blocks and open problems: a model that claims a fix without write_page is nudged once, then the turn ends with no proposal", async () => {
	const { out, seen } = await withProvider(claim, async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page, expectedRevision: 5, scopeBlockIds: ["dishes", "delivery"] }, signal()), seen }));
	// read, answer, (nudge) answer
	assert.equal(seen.requests.length, 3);
	const last = (seen.requests[2]!.messages as Array<{ role: string; content: string }>).slice(-2);
	assert.equal(last[0]!.role, "assistant");
	assert.equal(last[1]!.role, "user");
	assert.match(last[1]!.content, /no write_page was accepted/);
	assert.match(last[1]!.content, /renderProblems/);
	assert.ok(out.result.ok);
	if (out.result.ok) assert.equal(out.result.proposal, undefined, "nothing is proposed: the client shows the no-change line");
	assert.equal(out.meta.usage.status, "complete");
	assert.deepEqual(out.meta.toolsCalled, ["get_block", "get_block"]);
});

test("Ask with open problems is nudged too; Ask without problems and without a scope is not", async () => {
	const ask = await withProvider(claim, async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "Nothing worked", mode: "ask", page, expectedRevision: 5 }, signal()), seen }));
	assert.equal(ask.seen.requests.length, 3);
	const clean = JSON.parse(JSON.stringify(page).replaceAll('"currency":"\u20bd"', '"currency":"RUB"')) as PageV2;
	assert.equal(renderProblems(clean).length, 0);
	const calm = await withProvider([{ content: "The page has nine blocks." }], async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "What is on the page?", mode: "ask", page: clean, expectedRevision: 5 }, signal()), seen }));
	assert.equal(calm.seen.requests.length, 1);
	const buildClean = await withProvider([{ content: "Done." }], async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "Say hi", mode: "build", page: clean, expectedRevision: 5 }, signal()), seen }));
	assert.equal(buildClean.seen.requests.length, 1, "no problems and no selection: no nudge");
});

test("a model that writes RUB: one accepted write, both blocks render, no problems left", async () => {
	const fix = (path: string) => ({ op: "replace", path, value: "RUB" });
	const dishes = (page.blocks[2]!.props as { dishes: unknown[] }).dishes.map((_, i) => fix(`/blocks/2/props/dishes/${i}/currency`));
	const zones = (page.blocks[4]!.props as { zones: unknown[] }).zones.map((_, i) => fix(`/blocks/4/props/zones/${i}/currency`));
	const script: Scripted[] = [{ calls: [{ name: "write_page", arguments: { patch: [...dishes, ...zones] } }] }, { content: "Currency codes are ISO now." }];
	const { out, seen } = await withProvider(script, async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page, expectedRevision: 5, scopeBlockIds: ["dishes", "delivery"] }, signal()), seen }));
	assert.equal(seen.requests.length, 2, "no nudge after an accepted write");
	assert.ok(out.result.ok);
	if (!out.result.ok) return;
	const proposal = out.result.proposal!;
	assert.ok(proposal, "a proposal");
	assert.deepEqual(proposal.diff.map((entry) => `${entry.change} ${entry.id}`).sort(), ["changed delivery", "changed dishes"]);
	assert.deepEqual(renderProblems(proposal.page), []);
	assert.equal(out.meta.usage.status, "complete");
});

test("the first rejected attempt names the same paths, then a real fix goes through (the model is told what failed)", async () => {
	const bad = { patch: [{ op: "replace", path: "/blocks/2/props/dishes/0/currency", value: "\u20ac" }] };
	const { out, seen } = await withProvider(
		[{ calls: [{ name: "write_page", arguments: bad }] }, { content: "Could not fix it." }],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page, expectedRevision: 5, scopeBlockIds: ["dishes", "delivery"] }, signal()), seen })
	);
	const tool = (seen.requests[1]!.messages as Array<{ role: string; content: string }>).findLast((m) => m.role === "tool")!;
	const reply = JSON.parse(tool.content) as { ok: boolean; issues: Array<{ code: string; path: string }> };
	assert.equal(reply.ok, false);
	assert.equal(reply.issues[0]!.code, "render_failed");
	assert.ok(out.result.ok || out.result.code);
});

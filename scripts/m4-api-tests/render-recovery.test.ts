/**
 * ADR 0035 (first seen in owner session fail-aa57f99): the page holds a block that shows nothing in the preview (here the
 * team with no title and no members), the author asks Build to fix it with it selected, and the model answers "fixed" without calling write_page. The host must (1) show the
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

const clean = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/studio-fill.json", import.meta.url)), "utf8")) as PageV2;
const page = structuredClone(clean);
page.blocks[1]!.props = { title: "", members: [] };
const SCOPE = ["team"];
const BRIEF = "\u0411\u043b\u043e\u043a\u0438 \u043d\u0435 \u0440\u0435\u043d\u0434\u0435\u0440\u044f\u0442\u0441\u044f. \u041f\u043e\u0447\u0438\u043d\u0438 \u0438\u043b\u0438 \u0437\u0430\u043c\u0435\u043d\u0438";
let release: () => void;
before(async () => {
	release = await installBundleProbe();
});
after(() => release());

const claim: Scripted[] = [
	{ calls: [{ name: "get_block", arguments: { item: "team-simple" } }] },
	{ content: "Fixed: the team has its people now." }
];
const userPrompt = (request: Record<string, unknown>) => JSON.parse(String((request.messages as Array<{ role: string; content: string }>)[1]!.content)) as Record<string, unknown>;

test("the first prompt lists the render problems of the existing page, with paths", async () => {
	assert.equal(renderProblems(page).length, 1);
	const { seen } = await withProvider(claim, async (seen) => {
		await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page, expectedRevision: 5, scopeBlockIds: SCOPE }, signal());
		return { seen };
	});
	const prompt = userPrompt(seen.requests[0]!);
	const problems = prompt.renderProblems as Array<{ path: string; code: string; expected: string }>;
	assert.deepEqual(problems.map((p) => `${p.code} ${p.path}`), ["render_empty /blocks/1/props"]);
	assert.match(problems[0]!.expected, /empty lists: members/);
});

test("Build with selected blocks and open problems: a model that claims a fix without write_page is nudged once, then the turn ends with no proposal", async () => {
	const { out, seen } = await withProvider(claim, async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page, expectedRevision: 5, scopeBlockIds: SCOPE }, signal()), seen }));
	// read, answer, (nudge) answer
	assert.equal(seen.requests.length, 3);
	const last = (seen.requests[2]!.messages as Array<{ role: string; content: string }>).slice(-2);
	assert.equal(last[0]!.role, "assistant");
	assert.equal(last[1]!.role, "user");
	assert.match(last[1]!.content, /no write_page was accepted/);
	assert.match(last[1]!.content, /renderProblems/);
	assert.equal(out.result.ok, false);
	if (!out.result.ok) assert.equal(out.result.code, "build_no_proposal", "a claimed fix without an accepted write is not a completed Build");
	assert.equal(out.meta.usage.status, "complete");
	assert.deepEqual(out.meta.toolsCalled, ["get_block"]);
});

test("Ask is read-only and never nudged, with or without open problems (tool_choice stays auto); Build without problems is nudged", async () => {
	const ask = await withProvider(claim, async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "Nothing worked", mode: "ask", page, expectedRevision: 5 }, signal()), seen }));
	assert.equal(ask.seen.requests.length, 2, "read, answer: nothing to write in Ask");
	assert.ok(ask.seen.requests.every((r) => r.tool_choice === "auto"));
	assert.equal(renderProblems(clean).length, 0);
	const calm = await withProvider([{ content: "The page has two blocks." }], async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "What is on the page?", mode: "ask", page: clean, expectedRevision: 5 }, signal()), seen }));
	assert.equal(calm.seen.requests.length, 1);
	const buildClean = await withProvider([{ content: "Done." }], async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: "Say hi", mode: "build", page: clean, expectedRevision: 5 }, signal()), seen }));
	assert.equal(buildClean.seen.requests.length, 2, "Build without problems or selection is nudged too (and the next request forces write_page)");
	assert.deepEqual(buildClean.seen.requests.map((r) => r.tool_choice), ["required", { type: "function", function: { name: "write_page" } }]);
	assert.equal(calm.seen.requests[0]!.tool_choice, "auto", "Ask stays on auto");
});

test("a model that writes the team: one accepted write, the block renders, no problems left", async () => {
	const script: Scripted[] = [{ calls: [{ name: "write_page", arguments: { patch: [{ op: "replace", path: "/blocks/1/props", value: clean.blocks[1]!.props }] } }] }, { content: "The team has three people." }];
	const { out, seen } = await withProvider(script, async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page, expectedRevision: 5, scopeBlockIds: SCOPE }, signal()), seen }));
	assert.equal(seen.requests.length, 1, "an accepted write ends a Build turn: no nudge, no summary step");
	assert.ok(out.result.ok);
	if (!out.result.ok) return;
	const proposal = out.result.proposal!;
	assert.ok(proposal, "a proposal");
	assert.deepEqual(proposal.diff.map((entry) => `${entry.change} ${entry.id}`), ["changed team"]);
	assert.deepEqual(renderProblems(proposal.page), []);
	assert.equal(out.meta.usage.status, "complete");
});

test("the first rejected attempt names the same paths, then a real fix goes through (the model is told what failed)", async () => {
	const bad = { patch: [{ op: "add", path: "/blocks/1/props/description", value: "" }] };
	const { out, seen } = await withProvider(
		[{ calls: [{ name: "write_page", arguments: bad }] }, { content: "Could not fix it." }],
		async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, { brief: BRIEF, mode: "build", page, expectedRevision: 5, scopeBlockIds: SCOPE }, signal()), seen })
	);
	const tool = (seen.requests[1]!.messages as Array<{ role: string; content: string }>).findLast((m) => m.role === "tool")!;
	const reply = JSON.parse(tool.content) as { ok: boolean; issues: Array<{ code: string; path: string }> };
	assert.equal(reply.ok, false);
	assert.equal(reply.issues[0]!.code, "render_empty");
	assert.equal(reply.issues[0]!.path, "/blocks/1/props");
	assert.ok(out.result.ok || out.result.code);
});

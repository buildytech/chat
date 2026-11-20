/**
 * What a session file keeps for debugging (t85u step 4): a refusal before any request leaves the session total
 * complete; a rejected write keeps its whole issues and its arguments in a hash-only export, and so does the accepted
 * write of a proposal that was superseded (its page is kept nowhere else). Other bodies are still dropped.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { emptyPage } from "../../packages/builder-core/src/index.ts";
import { aggregateSessionUsage, aggregateStepUsage, notSentUsage, readProviderUsage } from "../../packages/chat-agent/src/usage.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { projectTraceBodies } from "../../apps/chat-web/src/lib/browser/trace-export.ts";
import { MODEL, installBundleProbe, signal, withProvider, type Scripted } from "./agent-replay.ts";

let restoreProbe: (() => void) | null = null;
before(async () => { restoreProbe = await installBundleProbe(); });
after(() => restoreProbe?.());

test("a run refused before any request (grok-build-0.1 not on the key) keeps the session total complete", () => {
	const billed = aggregateStepUsage([readProviderUsage({ prompt_tokens: 1709, completion_tokens: 6, cost_in_usd_ticks: 20168500 })]);
	const session = aggregateSessionUsage([billed, notSentUsage(), billed]);
	assert.equal(session.status, "complete");
	assert.equal(session.runs, 2);
	assert.equal(session.notSentRuns, 1);
	assert.equal(session.totalTokens, 2 * 1715);
	assert.equal(session.cost.available && session.cost.completeness, "complete");
	assert.equal(session.cost.available && session.cost.ticks, "40337000");
});

test("a hash-only export keeps the rejected write (whole issues + arguments) and a superseded proposal's write", async () => {
	const bad = { page: { version: 2, title: "Team", slug: "team", locale: "en", blocks: [{ item: "team-simple", variant: "cards3", props: { title: "Team", cols: "2", members: [{ id: "m1", title: "A" }] } }] } };
	const good = { page: { ...bad.page, blocks: [{ item: "team-simple", variant: "cards3", props: { title: "Team", members: [{ id: "m1", title: "A" }] } }] } };
	const script: Scripted[] = [{ calls: [{ name: "write_page", arguments: bad }] }, { calls: [{ name: "write_page", arguments: good }] }, { content: "Done." }];
	const start = emptyPage({ title: "New", locale: "en", id: "page-t", now: "2026-11-20T09:00:00.000Z" });
	const out = await withProvider(script, () => runXaiCatalogTurn("k", MODEL, { brief: "team", mode: "build", page: start, expectedRevision: 0 }, signal()));
	const trace = out.meta.runTrace!;
	const writes = trace.toolResults.filter((r) => r.name === "write_page");
	assert.deepEqual(writes.map((w) => w.accepted), [false, true]);
	const issue = writes[0]!.gate!.issues[0]!;
	assert.equal(issue.path, "/blocks/0/props/cols");
	assert.equal(issue.code, "props_invalid");
	assert.equal(issue.got, "2");
	assert.match(issue.expected ?? "", /variant cards3 sets cols/);
	const file = (status: string) => ({ sessions: [{ ext: { chat: { messages: [{ id: "a", role: "assistant", run: { runId: trace.runId }, proposal: { applied: false, status } }] }, "agent-trace": { [trace.runId]: trace } } }] });
	type Kept = { sessions: Array<{ ext: { "agent-trace": Record<string, { toolResults: Array<{ args: { body?: unknown }; argsKept?: string }>; prefix: { systemPrompt?: { body?: unknown } } }> } }> };
	const pending = projectTraceBodies(file("pending")) as unknown as Kept;
	const kept = pending.sessions[0]!.ext["agent-trace"][trace.runId]!;
	assert.deepEqual(kept.toolResults.filter((r) => "body" in r.args).map((r) => r.argsKept), ["rejected"]);
	assert.deepEqual(JSON.parse(String(kept.toolResults.find((r) => r.argsKept)!.args.body)), bad);
	assert.equal(kept.prefix.systemPrompt?.body, undefined, "prompts stay hash-only");
	const superseded = (projectTraceBodies(file("superseded")) as unknown as Kept).sessions[0]!.ext["agent-trace"][trace.runId]!;
	assert.deepEqual(superseded.toolResults.filter((r) => "body" in r.args).map((r) => r.argsKept), ["rejected", "superseded"]);
});

/**
 * Replays of the two live staging Build runs of 2026-11-20 (t83u, grok-4.20, buildy:v2 exports, studio "Quiet Rooms"):
 * (a) placeholders: no image / avatar; (b) stock photos: https images.unsplash.com URLs on the hero and every member.
 * Each run was get_block x2 + one write_page, gate clean. Here the exported file opens, the recorded write_page
 * (the applied page) is played back through the scripted provider into an empty page and the same gate accepts it
 * in one write with the same blocks, and the recorded per-step provider usage sums to the run usage and billed cost.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { checkPageDoc, emptyPage } from "../../packages/builder-core/src/index.ts";
import { aggregateStepUsage, readProviderUsage } from "../../packages/chat-agent/src/usage.ts";
import type { AgentReply } from "../../packages/chat-agent/src/index.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { parseSessionFile } from "../../apps/chat-web/src/lib/browser/session-file.ts";
import { MODEL, installBundleProbe, signal, withProvider, type Scripted } from "./agent-replay.ts";

type Step = { usage: { prompt: number; completion: number; cached?: number; reasoning?: number; cost_in_usd_ticks?: string | null }; response?: { tool_calls?: Array<{ name: string }> } };
type Trace = { stopReason: string; steps: Step[]; toolResults: Array<{ name: string; accepted?: boolean; gate?: { codes: string[] } }> };
type Run = { runId: string; tools: string[]; usage: Record<string, unknown> & { cost: unknown } };
type Exported = { format: string; sessions: Array<{ page: { applied: PageV2 }; ext: { chat: { messages: Array<{ role: string; run?: Run }> }; "agent-trace": Record<string, Trace> } }> };

const load = (name: string) => {
	const raw = readFileSync(new URL(`./fixtures/replay-v2-${name}.json`, import.meta.url), "utf8");
	return { raw, file: JSON.parse(raw) as Exported };
};
// The whole gate, render probe included (the compiled registry blocks), as on the runtime.
let restoreProbe: (() => void) | null = null;
before(async () => { restoreProbe = await installBundleProbe(); });
after(() => restoreProbe?.());

const runs = { placeholders: load("placeholders"), photos: load("photos") };
const media = (page: PageV2): string[] =>
	page.blocks.flatMap((b) => {
		const p = b.props as { image?: string; members?: Array<{ avatar?: string }> };
		return [p.image, ...(p.members ?? []).map((m) => m.avatar)].filter((v): v is string => typeof v === "string");
	});

for (const [name, { raw, file }] of Object.entries(runs)) {
	test(`live ${name}: the buildy:v2 export opens; the run was get_block x2 + one accepted write_page with a clean gate`, () => {
		assert.equal(file.format, "buildy:v2");
		const parsed = parseSessionFile(raw);
		assert.ok(parsed.ok, JSON.stringify(parsed));
		const session = file.sessions[0]!;
		const trace = Object.values(session.ext["agent-trace"])[0]!;
		const calls = trace.steps.flatMap((s) => (s.response?.tool_calls ?? []).map((c) => c.name));
		assert.deepEqual(calls, ["get_block", "get_block", "write_page"]);
		const writes = trace.toolResults.filter((r) => r.name === "write_page");
		assert.equal(writes.length, 1);
		assert.equal(writes[0]!.accepted, true);
		assert.deepEqual(writes[0]!.gate?.codes, []);
		assert.deepEqual(session.page.applied.blocks.map((b) => [b.item, b.variant]), [["hero-simple", "mediaStart"], ["team-simple", "cols3"]]);
		const urls = media(session.page.applied);
		if (name === "placeholders") assert.deepEqual(urls, [], "no pictures: the blocks show placeholders");
		else {
			assert.equal(urls.length, 4, "hero image + three avatars");
			for (const url of urls) assert.match(url, /^https:\/\/images\.(unsplash|pexels)\.com\//);
		}
	});

	test(`live ${name}: the recorded write_page replays into an empty page; one write, same blocks, the gate accepts it`, async () => {
		const applied = file.sessions[0]!.page.applied;
		const { version, title, slug, locale, seo, blocks } = applied;
		const script: Scripted[] = [
			{ calls: [{ name: "get_block", arguments: { item: "hero-simple" } }] },
			{ calls: [{ name: "get_block", arguments: { item: "team-simple" } }] },
			{ calls: [{ name: "write_page", arguments: { page: { version, title, slug, locale, seo, blocks } } }] },
			{ content: "Done." }
		];
		const start = emptyPage({ title: "New page", locale: "en", id: applied.id, now: applied.createdAt });
		const { out } = await withProvider(script, async (seen) => ({
			out: await runXaiCatalogTurn("k", MODEL, { brief: "Quiet Rooms studio: hero and team", mode: "build", page: start, expectedRevision: 0 }, signal()),
			seen
		}));
		assert.equal(out.meta.toolsCalled.filter((n) => n === "write_page").length, 1);
		const reply = out.result as AgentReply;
		assert.ok(reply.ok && reply.proposal, JSON.stringify(out.result).slice(0, 600));
		const written = reply.proposal!.page;
		assert.deepEqual(written.blocks.map((b) => [b.item, b.variant, b.props]), blocks.map((b) => [b.item, b.variant, b.props]));
		assert.ok(checkPageDoc(written).ok);
	});

	test(`live ${name}: the trace steps sum to the run usage and its billed cost exactly`, () => {
		const session = file.sessions[0]!;
		const [runId, trace] = Object.entries(session.ext["agent-trace"])[0]!;
		const run = session.ext.chat.messages.find((m) => m.run?.runId === runId)!.run!;
		const replayed = aggregateStepUsage(trace.steps.map((s) => readProviderUsage({
			prompt_tokens: s.usage.prompt,
			completion_tokens: s.usage.completion,
			cost_in_usd_ticks: s.usage.cost_in_usd_ticks ?? undefined,
			prompt_tokens_details: { cached_tokens: s.usage.cached ?? 0 },
			completion_tokens_details: { reasoning_tokens: s.usage.reasoning ?? 0 }
		})));
		for (const key of ["status", "steps", "promptTokens", "completionTokens", "totalTokens", "cachedTokens"]) assert.deepEqual((replayed as Record<string, unknown>)[key], run.usage[key], key);
		assert.deepEqual(replayed.cost, run.usage.cost);
	});
}

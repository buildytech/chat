/**
 * Replay of the owner's staging session of 2026-11-20 (t84u, grok-4.20, buildy:v2 export, "birthday of Karina"):
 * the first write_page of the Build run was rejected with props_invalid at /blocks/1/props/cols because the model wrote
 * the team-simple axis `cols` as the number 3 (the schema holds the text "2" | "3" | "4"), and the model wrote again.
 * The export keeps only the path and code of that write (its arguments are hash-only), so the write is rebuilt from the
 * applied page with `cols: 3`: the host now writes the enum in the schema's type and accepts it in one write, with a note.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { checkPageDoc, emptyPage } from "../../packages/builder-core/src/index.ts";
import type { AgentReply } from "../../packages/chat-agent/src/index.ts";
import { executeCatalogTool } from "../../packages/chat-agent/src/agent/catalog-tools.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { parseSessionFile } from "../../apps/chat-web/src/lib/browser/session-file.ts";
import { MODEL, installBundleProbe, signal, withProvider, type Scripted } from "./agent-replay.ts";

type ToolResult = { name: string; accepted?: boolean; gate?: { codes: string[]; issues: Array<{ path: string; code: string }> } };
type Exported = { format: string; sessions: Array<{ page: { applied: PageV2 }; ext: { "agent-trace": Record<string, { toolResults: ToolResult[] }> } }> };

const raw = readFileSync(new URL("./fixtures/replay-v2-owner-birthday.json", import.meta.url), "utf8");
const file = JSON.parse(raw) as Exported;
let restoreProbe: (() => void) | null = null;
before(async () => { restoreProbe = await installBundleProbe(); });
after(() => restoreProbe?.());

test("owner session: the export opens; the first write_page was rejected at /blocks/1/props/cols, the second accepted", () => {
	assert.equal(file.format, "buildy:v2");
	const parsed = parseSessionFile(raw);
	assert.ok(parsed.ok, JSON.stringify(parsed));
	const trace = Object.values(file.sessions[0]!.ext["agent-trace"])[0]!;
	const writes = trace.toolResults.filter((r) => r.name === "write_page");
	assert.deepEqual(writes.map((w) => w.accepted), [false, true]);
	assert.deepEqual(writes[0]!.gate?.issues.map((i) => [i.path, i.code]), [["/blocks/1/props/cols", "props_invalid"]]);
});

test("owner session: team-simple `cols` written as the number 3 is accepted in one write as the text \"3\", with a note", async () => {
	const applied = file.sessions[0]!.page.applied;
	const { version, title, slug, locale, seo } = applied;
	const blocks = applied.blocks.map((b) => (b.item === "team-simple" ? { ...b, props: { ...b.props, cols: 3 } } : b));
	const script: Scripted[] = [
		{ calls: [{ name: "get_block", arguments: { item: "hero-simple" } }] },
		{ calls: [{ name: "get_block", arguments: { item: "team-simple" } }] },
		{ calls: [{ name: "write_page", arguments: { page: { version, title, slug, locale, seo, blocks } } }] },
		{ content: "Done." }
	];
	const start = emptyPage({ title: "New page", locale: "en", id: applied.id, now: applied.createdAt });
	const out = await withProvider(script, () => runXaiCatalogTurn("k", MODEL, { brief: "birthday page from classmates", mode: "build", page: start, expectedRevision: 0 }, signal()));
	assert.equal(out.meta.toolsCalled.filter((n) => n === "write_page").length, 1, "one write, no props_invalid retry");
	const reply = out.result as AgentReply;
	assert.ok(reply.ok && reply.proposal, JSON.stringify(out.result).slice(0, 600));
	const team = reply.proposal!.page.blocks.find((b) => b.item === "team-simple")!;
	assert.equal(team.props.cols, "3");
	assert.equal(team.variant, "cards3");
	assert.ok(reply.proposal!.warnings.some((w) => w.includes('cols 3 -> "3"')), reply.proposal!.warnings.join(" | "));
	assert.ok(checkPageDoc(reply.proposal!.page).ok);
});

test("owner session: get_block writes enums in the schema's type and leaves the layout axes to the variant", () => {
	const read = executeCatalogTool({ name: "get_block", arguments: { item: "team-simple" } });
	assert.ok(read.ok);
	const result = read.result as { props: string[]; sample: Record<string, unknown>; layout?: string };
	assert.ok(result.props.includes("level?: enum 1|2|3"), result.props.join(" | "));
	assert.ok(result.props.includes('align?: enum "start"|"center"|"end"'), result.props.join(" | "));
	assert.ok(!result.props.some((line) => /^(cols|surface)\??:/.test(line)), "axes are not props of the outline");
	assert.equal("cols" in result.sample || "surface" in result.sample, false);
	assert.match(result.layout ?? "", /variant sets cols, surface/);
});

test("owner session: the host summary facts of the Build run name the fixed gate error; the second run was edit-fields", async () => {
	const { buildSummaryFacts } = await import("../../packages/chat-agent/src/index.ts");
	const session = file.sessions[0]!;
	const [build, fields] = Object.values(session.ext["agent-trace"]) as unknown as Array<Parameters<typeof buildSummaryFacts>[1]>;
	const first = buildSummaryFacts(session.page.applied, build);
	assert.deepEqual(first.fixed, ["props_invalid /blocks/1/props/cols"]);
	assert.equal(first.rejectedWrites, 1);
	assert.equal(first.editFields, false);
	assert.deepEqual(first.blocks, ["hero-simple mediaTop", "team-simple cards3"]);
	const second = buildSummaryFacts(session.page.applied, fields);
	assert.equal(second.editFields, true);
	assert.deepEqual(second.fixed, []);
});

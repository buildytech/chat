import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { baseHashes, blockBaseHash, readProposalBases, staleBlocks, type ProposalBase } from "../../packages/chat-agent/src/index.ts";
import { diffPages } from "../../packages/builder-core/src/index.ts";
import { projectOfView, viewOf } from "../../apps/chat-web/src/modules/chat/core/view.ts";

const page = (blocks: unknown[]) => JSON.parse(JSON.stringify({ format: "page-spec/v2", page: { id: "p", title: "P", locale: "ru" }, blocks }));
const hero = { id: "hero", item: "hero-simple", variant: "mediaEnd", props: { title: "A" } };
const team = { id: "team", item: "team-simple", variant: "cols3", props: { title: "T" } };

test("baseHash covers the changed, removed and moved blocks; a hand edit makes them stale", () => {
	const base = page([hero, team]);
	const next = page([{ ...hero, props: { title: "B" } }]);
	const diff = diffPages(base, next);
	const hashes = baseHashes(base, diff);
	assert.deepEqual(Object.keys(hashes).sort(), ["hero", "team"]);
	assert.equal(hashes.hero, blockBaseHash(hero));
	assert.deepEqual(staleBlocks(base, hashes), []);
	assert.deepEqual(staleBlocks(page([{ ...hero, props: { title: "by hand" } }, team]), hashes), ["hero"]);
	assert.deepEqual(staleBlocks(page([hero, { ...team, variant: "cols2" }]), hashes), ["team"]);
	assert.deepEqual(staleBlocks(page([hero]), hashes), ["team"], "a block removed by hand is stale too");
	// An added block has no base: a fresh page has nothing to protect.
	assert.deepEqual(baseHashes(page([]), diffPages(page([]), base)), {});
});

test("the baseHash record is a chat-local session ext that roundtrips and never touches page/blocks", () => {
	const record: ProposalBase = { format: "proposal-base/1", source: "applied", baseRevision: 3, base: { hero: blockBaseHash(hero) }, applied: { hero: blockBaseHash(hero) } };
	const project = projectOfView({ id: "s", title: "S", updatedAt: "2026-11-20T10:00:00Z", messages: [], proposalBases: { m1: record } }, null);
	assert.deepEqual(project.ext["chat-proposal-base"], { m1: record });
	assert.deepEqual(viewOf(project).proposalBases, { m1: record });
	assert.deepEqual(readProposalBases({ m1: record, m2: { ...record, format: "proposal-base/9" } }), { m1: record }, "unknown records are left out");
	assert.equal("chat-proposal-base" in projectOfView({ ...viewOf(project), proposalBases: {} }, project).ext, false);
});

test("Apply is blocked and the reply is not installed when the base changed by hand", () => {
	const flow = readFileSync("apps/chat-web/src/modules/chat/core/proposal-flow.ts", "utf8");
	assert.match(flow, /const stale = staleForApply\(getSelectedSession\(\)\);\n\tif \(stale\.length\) \{\n\t\trun\.lastError = t\("proposal\.baseChanged"\)/);
	const turn = readFileSync("apps/chat-web/src/modules/chat/core/turn.ts", "utf8");
	assert.ok(turn.indexOf("staleBlocks(plan.source") < turn.indexOf("setCandidatePage(checked.page"), "stale check runs before the candidate is installed");
	for (const lang of ["ru", "en"]) {
		const dict = readFileSync(`apps/chat-web/src/modules/chat/i18n/${lang}.json`, "utf8");
		assert.match(dict, /"proposal\.baseChanged": "[^"]*\{blocks\}/);
		assert.match(dict, /"proposal\.staleOnReply": "[^"]*\{blocks\}/);
	}
});

test("the session file stores lastProposed equal to applied/candidate once, by reference, and import restores it", async () => {
	const { buildSessionFile, parseSessionFile, splitSessionFile } = await import("../../apps/chat-web/src/lib/browser/session-file.ts");
	const owner = JSON.parse(readFileSync("scripts/m4-api-tests/fixtures/replay-v2-owner-birthday.json", "utf8"));
	const parsed = parseSessionFile(owner);
	assert.ok(parsed.ok);
	const { chats, pages } = splitSessionFile(parsed.file);
	const record = Object.values(pages)[0]!;
	assert.deepEqual(record.lastProposed, record.applied, "the owner's session carries the applied page twice");
	const file = buildSessionFile({ chats, pages, selectedSessionId: parsed.file.selectedSessionId, app: parsed.file.app, pins: parsed.file.pins, now: parsed.file.exportedAt });
	const session = file.sessions[0]!;
	assert.equal(session.page?.lastProposed, null);
	assert.deepEqual(session.ext && (session.ext as Record<string, unknown>)["chat-page-ref"], { format: "page-ref/1", lastProposed: "applied" });
	assert.ok(JSON.stringify(file).length < JSON.stringify(owner).length - JSON.stringify(record.applied).length / 2);
	const again = parseSessionFile(JSON.parse(JSON.stringify(file)));
	assert.ok(again.ok, "the deduplicated file is valid against the vendored session-v2 / page-spec-v2 0.5.0");
	const restored = again.file.sessions[0]!;
	assert.deepEqual(restored.page?.lastProposed, record.applied);
	assert.deepEqual(restored.page?.lastProposedProvenance, record.lastProposedProvenance);
	assert.equal("chat-page-ref" in (restored.ext as object), false);
	// A lastProposed that differs from both pages is kept whole.
	const own = { ...record, lastProposed: { ...record.applied as object, page: { id: "x", title: "Other", locale: "ru" } } };
	assert.ok(buildSessionFile({ chats, pages: { [Object.keys(pages)[0]!]: own }, selectedSessionId: null, app: parsed.file.app, pins: parsed.file.pins }).sessions[0]!.page?.lastProposed);
});

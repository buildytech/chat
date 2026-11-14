/**
 * ADR 0035: a page that passes write_page must show something in the preview. The runtime renders every added or changed block
 * with the compiled registry blocks (the render probe) and rejects what throws or shows nothing, with the path of the prop.
 * The owner's session 1e1031a: a currency symbol where the component calls Intl.NumberFormat made two blocks throw, the
 * preview showed blanks, and the gate had accepted them.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPage, installRenderProbe, probeFromModule, writePage, type DocIssue } from "../../packages/builder-core/src/index.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const BUNDLE = join(ROOT, "api", "runtime", "_render", "blocks.mjs");
const NOW = "2026-11-13T18:00:00.000Z";
const owner = JSON.parse(readFileSync(join(ROOT, "scripts/m4-api-tests/fixtures/blocks-page-1e1031a.json"), "utf8")) as PageV2;

before(async () => {
	if (!existsSync(BUNDLE)) spawnSync(process.execPath, [join(ROOT, "scripts/build-render-bundle.mjs")], { cwd: ROOT, stdio: "pipe" });
	const mod = (await import(pathToFileURL(BUNDLE).href)) as Parameters<typeof probeFromModule>[0];
	installRenderProbe(probeFromModule(mod), { required: true });
});
after(() => installRenderProbe(null));

const issuesOf = (r: ReturnType<typeof writePage>): DocIssue[] => (r.ok ? [] : r.issues);

test("the owner's page: both blocks that threw are rejected with the path of the currency value", () => {
	const r = writePage(emptyPage({ title: "x", now: NOW }), { page: owner }, { now: NOW });
	assert.equal(r.ok, false);
	const failed = issuesOf(r).filter((issue) => issue.code === "render_failed");
	assert.deepEqual(failed.map((issue) => issue.path), ["/blocks/2/props/dishes/0/currency", "/blocks/4/props/zones/0/currency"]);
	assert.match(String(failed[0]!.expected), /Invalid currency code/);
	assert.equal(failed[0]!.got, "Invalid currency code : \u20bd");
});

test("with ISO currency codes the same page is accepted and no block is blank", () => {
	const fixed = JSON.parse(JSON.stringify(owner).replaceAll('"currency":"\u20bd"', '"currency":"RUB"')) as PageV2;
	const r = writePage(emptyPage({ title: "x", now: NOW }), { page: fixed }, { now: NOW });
	assert.ok(r.ok, JSON.stringify(issuesOf(r)));
});

test("a block that renders nothing is rejected (faq-split written with empty lists), with the empty lists named", () => {
	const r = writePage(emptyPage({ title: "x", now: NOW }), { patch: [{ op: "add", path: "/blocks/-", value: { item: "faq-split", variant: "headSplit", props: { items: [], channels: [], topics: [] } } }] }, { now: NOW });
	assert.equal(r.ok, false);
	const issue = issuesOf(r)[0]!;
	assert.equal(issue.code, "render_empty");
	assert.equal(issue.path, "/blocks/0/props");
	assert.match(issue.expected, /empty lists: .*items/);
});

test("blocks a write does not touch are not probed: a page that already holds the blank blocks can still be renamed", () => {
	const renamed = writePage(owner, { patch: [{ op: "replace", path: "/title", value: "New name" }] }, { now: NOW });
	assert.ok(renamed.ok, JSON.stringify(issuesOf(renamed)));
	// touching one of the broken blocks is probed again
	const touched = writePage(owner, { patch: [{ op: "replace", path: "/blocks/4/props/title", value: "Zones" }] }, { now: NOW });
	assert.equal(touched.ok, false);
	assert.equal(issuesOf(touched)[0]!.code, "render_failed");
});

test("a required probe that is missing fails every write instead of passing silently", () => {
	installRenderProbe(null, { required: true });
	const r = writePage(emptyPage({ title: "x", now: NOW }), { patch: [{ op: "add", path: "/blocks/-", value: { item: "cta-band", variant: "band" } }] }, { now: NOW });
	assert.equal(r.ok, false);
	assert.equal(issuesOf(r)[0]!.code, "render_probe_unavailable");
});

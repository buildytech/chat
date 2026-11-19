/**
 * ADR 0035: a page that passes write_page must show something in the preview. The runtime renders every added or changed block
 * with the compiled registry blocks (the render probe) and rejects what throws or shows nothing, with the path of the prop.
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
const studio = JSON.parse(readFileSync(join(ROOT, "scripts/m4-api-tests/fixtures/studio-fill.json"), "utf8")) as PageV2;
let real: ReturnType<typeof probeFromModule>;
/** The compiled blocks, except that a title "boom" throws the way a component throws on a value it cannot format. */
const install = () =>
	installRenderProbe((organism, props) => ((props as { title?: unknown }).title === "boom" ? { ok: false, error: "Invalid value : boom" } : real(organism, props)), { required: true });

before(async () => {
	if (!existsSync(BUNDLE)) spawnSync(process.execPath, [join(ROOT, "scripts/build-render-bundle.mjs")], { cwd: ROOT, stdio: "pipe" });
	const mod = (await import(pathToFileURL(BUNDLE).href)) as Parameters<typeof probeFromModule>[0];
	real = probeFromModule(mod);
	install();
});
after(() => installRenderProbe(null));

const issuesOf = (r: ReturnType<typeof writePage>): DocIssue[] => (r.ok ? [] : r.issues);
const EMPTY_TEAM = { item: "team-simple", variant: "cols3", props: { title: "", members: [] } };

test("a block whose component throws is rejected with the path of the value it threw on", () => {
	const bad = structuredClone(studio);
	(bad.blocks[0]!.props as Record<string, unknown>).title = "boom";
	const r = writePage(emptyPage({ title: "x", now: NOW }), { page: bad }, { now: NOW });
	assert.equal(r.ok, false);
	const failed = issuesOf(r).filter((issue) => issue.code === "render_failed");
	assert.deepEqual(failed.map((issue) => issue.path), ["/blocks/0/props/title"]);
	assert.match(String(failed[0]!.expected), /threw "Invalid value : boom"/);
	assert.equal(failed[0]!.got, "Invalid value : boom");
});

test("the studio page is accepted and no block is blank", () => {
	const r = writePage(emptyPage({ title: "x", now: NOW }), { page: studio }, { now: NOW });
	assert.ok(r.ok, JSON.stringify(issuesOf(r)));
});

test("a block that renders nothing is rejected (team-simple with no title and no members), with the empty lists named", () => {
	const r = writePage(emptyPage({ title: "x", now: NOW }), { patch: [{ op: "add", path: "/blocks/-", value: EMPTY_TEAM }] }, { now: NOW });
	assert.equal(r.ok, false);
	const issue = issuesOf(r)[0]!;
	assert.equal(issue.code, "render_empty");
	assert.equal(issue.path, "/blocks/0/props");
	assert.match(issue.expected, /empty lists: .*members/);
});

test("blocks a write does not touch are not probed: a page that already holds a blank block can still be renamed", () => {
	installRenderProbe(null);
	const held = writePage(emptyPage({ title: "x", now: NOW }), { patch: [{ op: "add", path: "/blocks/-", value: EMPTY_TEAM }] }, { now: NOW });
	install();
	assert.ok(held.ok, JSON.stringify(issuesOf(held)));
	const renamed = writePage(held.page, { patch: [{ op: "replace", path: "/title", value: "New name" }] }, { now: NOW });
	assert.ok(renamed.ok, JSON.stringify(issuesOf(renamed)));
	// touching the blank block probes it again
	const touched = writePage(held.page, { patch: [{ op: "add", path: "/blocks/0/props/align", value: "center" }] }, { now: NOW });
	assert.equal(touched.ok, false);
	assert.equal(issuesOf(touched)[0]!.code, "render_empty");
});

test("a required probe that is missing fails every write instead of passing silently", () => {
	installRenderProbe(null, { required: true });
	const r = writePage(emptyPage({ title: "x", now: NOW }), { patch: [{ op: "add", path: "/blocks/-", value: { item: "hero-simple", variant: "mediaEnd" } }] }, { now: NOW });
	assert.equal(r.ok, false);
	assert.equal(issuesOf(r)[0]!.code, "render_probe_unavailable");
});

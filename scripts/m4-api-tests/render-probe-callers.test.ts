/**
 * ADR 0038: ONE render probe. `probeFromModule` is the only function that turns compiled blocks into a probe; write-time
 * (`writePage` and every op over it), the turn-start check (`renderProblems`), the coverage script and the browser all use
 * it, and give the same verdict on the same blocks. Browser policy: a block that throws is refused, a block that only shows
 * nothing (a registry sample that is a placeholder) is accepted and the preview says so.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	applyOp,
	emptyPage,
	installRenderProbe,
	probeFromModule,
	probeOutcome,
	renderBlock,
	renderProblems,
	writePage,
	type RenderModule
} from "../../packages/builder-core/src/index.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import { loadRenderProbe, RENDER_BUNDLE_PATH } from "../../apps/chat-web/src/lib/preview/render-probe.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const BUNDLE = join(ROOT, "api", "runtime", "_render", "blocks.mjs");
const NOW = "2026-11-14T12:00:00.000Z";
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const owner = JSON.parse(read("scripts/m4-api-tests/fixtures/blocks-page-1e1031a.json")) as PageV2;
const fixed = JSON.parse(JSON.stringify(owner).replaceAll('"currency":"\u20bd"', '"currency":"RUB"')) as PageV2;

let bundle: RenderModule;
before(async () => {
	if (!existsSync(BUNDLE)) spawnSync(process.execPath, [join(ROOT, "scripts/build-render-bundle.mjs")], { cwd: ROOT, stdio: "pipe" });
	bundle = (await import(pathToFileURL(BUNDLE).href)) as RenderModule;
});
after(() => installRenderProbe(null));

const fake = (render: (props: Record<string, unknown>) => string): RenderModule => ({ blocks: new Proxy({} as Record<string, unknown>, { get: (_t, key) => (typeof key === "string" && key.startsWith("blocks/none") ? undefined : {}) }), render: ((_: never, o: { props: Record<string, unknown> }) => ({ body: render(o.props) })) as RenderModule["render"] });

test("probeFromModule: a missing block and a throwing component are failed results, a render is its html", () => {
	const probe = probeFromModule(fake((props) => { if (props.boom) throw new Error("boom\nsecond line"); return `<p>${String(props.text ?? "")}</p>`; }));
	assert.deepEqual(probe("blocks/none.svelte", {}), { ok: false, error: "no compiled block blocks/none.svelte" });
	assert.deepEqual(probe("blocks/x.svelte", { boom: true }), { ok: false, error: "boom\nsecond line" });
	assert.deepEqual(probe("blocks/x.svelte", { text: "hi" }), { ok: true, html: "<p>hi</p>" });
});

test("probeOutcome: throws, empty, content (an icon or a control is content)", () => {
	assert.equal(probeOutcome({ ok: false, error: "x" }), "throws");
	assert.equal(probeOutcome({ ok: true, html: "<!----><div> </div>" }), "empty");
	assert.equal(probeOutcome({ ok: true, html: "<div><p>text</p></div>" }), "content");
	assert.equal(probeOutcome({ ok: true, html: "<div><svg></svg></div>" }), "content");
});

test("write-time: the empty policy decides what a block that shows nothing does; a block that throws is refused under both", () => {
	const add = { patch: [{ op: "add", path: "/blocks/-", value: { item: "cta-band", variant: "band" } }] };
	const blank = probeFromModule(fake(() => "<div></div>"));
	const boom = probeFromModule(fake(() => { throw new Error("nope"); }));
	installRenderProbe(blank, { required: true });
	assert.equal(writePage(emptyPage({ title: "x", now: NOW }), add, { now: NOW }).ok, false, "agent host: empty is rejected");
	installRenderProbe(blank, { required: true, empty: "allow" });
	assert.ok(writePage(emptyPage({ title: "x", now: NOW }), add, { now: NOW }).ok, "browser: empty is accepted");
	installRenderProbe(boom, { required: true, empty: "allow" });
	const refused = writePage(emptyPage({ title: "x", now: NOW }), add, { now: NOW });
	assert.equal(refused.ok, false);
	assert.equal(refused.ok ? "" : refused.issues[0]!.code, "render_failed");
});

test("a write with nothing to render (rename, move, remove) is not failed by a missing probe; an add is", () => {
	installRenderProbe(null, { required: true });
	const base = writePage(emptyPage({ title: "x", now: NOW }), { page: fixed }, { now: NOW });
	assert.equal(base.ok, false, "a page full of new blocks needs the probe");
	installRenderProbe(probeFromModule(bundle), { required: true });
	const ok = writePage(emptyPage({ title: "x", now: NOW }), { page: fixed }, { now: NOW });
	assert.ok(ok.ok);
	installRenderProbe(null, { required: true });
	if (!ok.ok) return;
	assert.ok(writePage(ok.page, { patch: [{ op: "replace", path: "/title", value: "Renamed" }] }, { now: NOW }).ok, "rename: no block rendered, nothing unchecked");
});

test("the browser loads the shared bundle and installs the probe: the Inspector edit that makes a component throw is refused with the prop's path", async () => {
	assert.equal(RENDER_BUNDLE_PATH, "/render/blocks.mjs");
	installRenderProbe(null, { required: true, empty: "allow" });
	await loadRenderProbe(pathToFileURL(BUNDLE).href);
	const edit = applyOp(fixed, { op: "set", blockId: "dishes", pointer: "/dishes/0/currency", value: "\u20bd" });
	assert.equal(edit.ok, false, "a currency symbol where the component calls Intl.NumberFormat");
	if (!edit.ok) {
		assert.equal(edit.code, "render_failed");
		assert.equal(edit.pointer, "/blocks/2/props/dishes/0/currency");
	}
	assert.ok(applyOp(fixed, { op: "set", blockId: "dishes", pointer: "/dishes/0/currency", value: "USD" }).ok, "a valid code is accepted");
});

test("the browser accepts a Blocks feed add whose registry sample is a placeholder (renders nothing); the preview says so", () => {
	installRenderProbe(probeFromModule(bundle), { required: true, empty: "allow" });
	const added = applyOp(fixed, { op: "add", item: "site-footer", variant: "minimal" });
	assert.ok(added.ok, added.ok ? "" : added.message);
	installRenderProbe(probeFromModule(bundle), { required: true });
	assert.equal(applyOp(fixed, { op: "add", item: "site-footer", variant: "minimal" }).ok, false, "the agent host still rejects it");
});

test("every caller gives the same verdict: write-time, turn-start and the coverage classifier agree on the owner's page", () => {
	const probe = probeFromModule(bundle);
	installRenderProbe(probe, { required: true });
	const write = writePage(emptyPage({ title: "x", now: NOW }), { page: owner }, { now: NOW });
	const writePaths = (write.ok ? [] : write.issues.filter((i) => i.code === "render_failed")).map((i) => i.path);
	const turnStart = renderProblems(owner).map((i) => i.path);
	const coverage = owner.blocks.flatMap((block, index) => {
		const r = renderBlock(block)!;
		return probeOutcome(probe(r.organism, r.props)) === "throws" ? [`/blocks/${index}`] : [];
	});
	assert.deepEqual(writePaths.map((p) => p.split("/props")[0]), coverage);
	assert.deepEqual(turnStart.map((p) => p.split("/props")[0]), coverage);
	assert.deepEqual(coverage, ["/blocks/2", "/blocks/4"]);
});

test("there is one probe closure: runtime, coverage script and browser call probeFromModule, none hand-rolls a render", () => {
	const runtime = read("apps/xai-runtime/src/http.ts");
	const script = read("scripts/inspector-coverage.mjs");
	const browser = read("apps/chat-web/src/lib/preview/render-probe.ts");
	for (const [name, src] of [["runtime", runtime], ["coverage script", script], ["browser", browser]] as const) {
		assert.match(src, /probeFromModule/, `${name} uses the shared probe`);
		assert.doesNotMatch(src, /\.render\(\s*[\w.\[\]]+,\s*\{\s*props/, `${name} does not call a block render itself`);
	}
	assert.match(script, /probeOutcome/);
	assert.match(browser, /empty: "allow"/);
	assert.match(read("apps/chat-web/src/lib/gates.ts"), /loadRenderProbe/);
});

test("turn-start: the page is probed once per turn and the result serves the prompt and the nudge", () => {
	const tools = read("apps/xai-runtime/src/chat-tools.ts");
	assert.equal((tools.match(/renderProblems\(ctx\.page\)/g) ?? []).length, 1);
	assert.match(tools, /userPrompt\(ctx, problems\)/);
	assert.match(tools, /const open = problems\.length/);
});

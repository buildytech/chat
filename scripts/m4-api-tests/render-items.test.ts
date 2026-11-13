/**
 * ADR 0035: every registry item + variant the write gate accepts renders something through the registry component, with its
 * sample props, and so do the blocks of the owner's session 1e1031a. The independent renderer here is the Vite + Svelte
 * pipeline of the preview (SSR of the registry source); the gate's own check is the compiled bundle of the render probe.
 * What the gate accepts must render; what it rejects must be rejected for a reason the preview confirms.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { allItems, emptyPage, installRenderProbe, itemInfo, renderBlock, sampleProps, showsContent, writePage } from "../../packages/builder-core/src/index.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const BUNDLE = join(ROOT, "api", "runtime", "_render", "blocks.mjs");
const REGISTRY = realpathSync.native(join(ROOT, "registry", "svelte"));
const NOW = "2026-11-13T18:00:00.000Z";

let server: ViteDevServer;
let renderSsr: (component: unknown, options: { props: Record<string, unknown> }) => { body: string };

function viteId(id: string): string {
	const q = id.indexOf("?");
	return realpathSync.native(q === -1 ? id : id.slice(0, q)).replaceAll("\\", "/") + (q === -1 ? "" : id.slice(q));
}

before(async () => {
	if (!existsSync(BUNDLE)) spawnSync(process.execPath, [join(ROOT, "scripts/build-render-bundle.mjs")], { cwd: ROOT, stdio: "pipe" });
	const mod = (await import(pathToFileURL(BUNDLE).href)) as { blocks: Record<string, unknown>; render: (c: unknown, o: { props: Record<string, unknown> }) => { body: string } };
	installRenderProbe((organism, props) => {
		try {
			return { ok: true, html: mod.render(mod.blocks[organism], { props }).body };
		} catch (err) {
			return { ok: false, error: (err as Error).message };
		}
	}, { required: true });
	server = await createServer({ root: REGISTRY, configFile: false, logLevel: "error", plugins: [svelte()], server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", optimizeDeps: { noDiscovery: true, include: [] } });
	const resolved = await server.pluginContainer.resolveId("svelte/server");
	const loaded = (await server.ssrLoadModule(viteId(typeof resolved === "string" ? resolved : resolved!.id))) as { render: typeof renderSsr };
	renderSsr = loaded.render;
});
after(async () => {
	installRenderProbe(null);
	await server?.close();
});

/** The preview's outcome for a block: the registry component through Vite SSR. */
async function previewOutcome(block: { item: string; variant?: string; props?: Record<string, unknown> }): Promise<"renders" | "blank" | { throws: string }> {
	const rendered = renderBlock(block as never);
	if (!rendered) return { throws: "not in the registry" };
	try {
		const mod = (await server.ssrLoadModule(`/src/${rendered.organism}`)) as { default: unknown };
		return showsContent(renderSsr(mod.default, { props: rendered.props }).body) ? "renders" : "blank";
	} catch (err) {
		return { throws: (err as Error).message.split("\n")[0]! };
	}
}

test("every item + variant: what write_page accepts with its sample props renders; nothing accepted throws or is blank", { timeout: 240_000 }, async () => {
	const accepted: string[] = [];
	const rejected: string[] = [];
	const wrong: string[] = [];
	for (const item of allItems()) {
		for (const variant of itemInfo(item)!.variants) {
			const written = writePage(emptyPage({ title: "t", now: NOW }), { patch: [{ op: "add", path: "/blocks/-", value: { item, variant } }] }, { now: NOW });
			const label = `${item}/${variant}`;
			if (written.ok) {
				accepted.push(label);
				const outcome = await previewOutcome(written.page.blocks[0]!);
				if (outcome !== "renders") wrong.push(`${label}: accepted but the preview ${typeof outcome === "string" ? outcome : `throws ${outcome.throws}`}`);
			} else {
				rejected.push(label);
				const codes = written.issues.map((issue) => issue.code);
				// a header-like block alone on a page is fine; a rejection is for props or for a render problem, which the preview must confirm
				if (codes.includes("render_empty") || codes.includes("render_failed")) {
					const outcome = await previewOutcome({ item, variant, props: sampleProps(item, variant, "b1") });
					if (outcome === "renders") wrong.push(`${label}: rejected (${codes.join(",")}) but the preview renders it`);
				}
			}
		}
	}
	assert.deepEqual(wrong, []);
	assert.ok(accepted.length + rejected.length >= 532, `${accepted.length + rejected.length} combinations`);
	assert.ok(accepted.length > 400, `${accepted.length} accepted`);
});

test("the owner's session blocks (currency codes fixed): every block renders in the preview pipeline", async () => {
	const page = JSON.parse(readFileSync(join(ROOT, "scripts/m4-api-tests/fixtures/blocks-page-1e1031a.json"), "utf8")) as PageV2;
	const fixed = JSON.parse(JSON.stringify(page).replaceAll('"currency":"\u20bd"', '"currency":"RUB"')) as PageV2;
	assert.ok(writePage(emptyPage({ title: "t", now: NOW }), { page: fixed }, { now: NOW }).ok);
	const outcomes: Record<string, unknown> = {};
	for (const block of fixed.blocks) outcomes[block.id] = await previewOutcome(block as never);
	assert.deepEqual(Object.values(outcomes), fixed.blocks.map(() => "renders"));
	// and as the owner had it: the two blocks the preview threw on
	const before = await Promise.all(page.blocks.map((block) => previewOutcome(block as never)));
	assert.deepEqual(before.map((outcome) => (typeof outcome === "string" ? outcome : "throws")), ["renders", "renders", "throws", "renders", "throws", "renders", "renders", "renders", "renders"]);
});

test("the owner's session fail-aa57f99: ISO currency makes all 9 blocks render, and prices are minor units (450 shows as 4.50)", async () => {
	const page = JSON.parse(readFileSync(join(ROOT, "scripts/m4-api-tests/fixtures/fail-page-aa57f99.json"), "utf8")) as PageV2;
	assert.equal(page.blocks.length, 9);
	const fixed = JSON.parse(JSON.stringify(page).replaceAll('"currency":"\u20bd"', '"currency":"RUB"')) as PageV2;
	assert.ok(writePage(emptyPage({ title: "t", now: NOW }), { page: fixed }, { now: NOW }).ok);
	const outcomes = await Promise.all(fixed.blocks.map((block) => previewOutcome(block as never)));
	assert.deepEqual(outcomes, fixed.blocks.map(() => "renders"));
	const before = await Promise.all(page.blocks.map((block) => previewOutcome(block as never)));
	assert.equal(before.filter((outcome) => typeof outcome !== "string").length, 2, "as the owner had it: exactly the two currency blocks throw");
	const dish = fixed.blocks[2]!;
	const rendered = renderBlock(dish as never)!;
	const mod = (await server.ssrLoadModule(`/src/${rendered.organism}`)) as { default: unknown };
	const html = renderSsr(mod.default, { props: rendered.props }).body;
	const first = (dish.props as { dishes: Array<{ price: number }> }).dishes[0]!.price;
	assert.ok(first >= 100, "price is stored in minor units");
	assert.ok(html.includes((first / 100).toFixed(2).replace(".", ",")) || html.includes((first / 100).toFixed(2)), `renders ${first} as ${(first / 100).toFixed(2)}`);
});

/**
 * Every Stock catalog asset (spec/variant) renders through its UI8Kit registry block (SSR, the pinned CLI snapshot)
 * with the props the chat maps from a page block: no stub, no throw, the block title on the page.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { catalogSnapshot, organismFor } from "../../packages/builder-core/src/index.ts";

const SNAPSHOT = fileURLToPath(new URL("../../registry/svelte", import.meta.url));

test("all 532 catalog assets render via their registry block (SSR)", { timeout: 240_000 }, async () => {
	const server = await createServer({
		root: SNAPSHOT,
		configFile: false,
		logLevel: "error",
		plugins: [svelte()],
		server: { middlewareMode: true, hmr: false, watch: null },
		appType: "custom",
		optimizeDeps: { noDiscovery: true, include: [] }
	});
	try {
		const { render } = (await server.ssrLoadModule("svelte/server")) as { render: (component: unknown, options: { props: Record<string, unknown> }) => { body: string } };
		const failures: string[] = [];
		let rendered = 0;
		let titled = 0;
		const ids = catalogSnapshot.blockIndex.flatMap((entry) => entry.catalogIds);
		for (const id of ids) {
			const slash = id.indexOf("/");
			const block = {
				id: "block-x",
				kind: "features",
				title: "Block title",
				summary: "Block summary",
				catalogBlock: id.slice(0, slash),
				variant: id.slice(slash + 1),
				copy: { action: "Go", href: "#go" },
				children: [
					{ id: "row-1", kind: "feature", title: "Row one", summary: "First row", copy: { icon: "zap" } },
					{ id: "row-2", kind: "feature", title: "Row two", summary: "Second row" }
				]
			};
			const hit = organismFor(block as never);
			if (!hit) {
				failures.push(`${id}: stub`);
				continue;
			}
			try {
				const module = (await server.ssrLoadModule(`/src/${hit.organism}`)) as { default: unknown };
				const body = render(module.default, { props: hit.props }).body;
				assert.ok(body.length > 0);
				rendered += 1;
				if (body.includes("Block title")) titled += 1;
			} catch (err) {
				failures.push(`${id} (${hit.item}): ${(err as Error).message.split("\n")[0]}`);
			}
		}
		assert.deepEqual(failures, []);
		assert.equal(rendered, 532);
		// Header/footer/product-like blocks name their heading otherwise (brand, name); most show the block title.
		assert.ok(titled >= 490, `title shown in ${titled}/532`);
	} finally {
		await server.close();
	}
});

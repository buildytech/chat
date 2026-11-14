/**
 * Every Stock catalog asset (spec/variant) renders through its UI8Kit registry block (SSR, the pinned CLI snapshot)
 * with the sample props of a new page-spec/v2 block (the props the Blocks feed writes): no stub, no throw, markup on the page.
 */
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { catalogSnapshot, catalogSources, registryItemFor, sampleProps } from "../../packages/builder-core/src/index.ts";

const SNAPSHOT = realpathSync.native(fileURLToPath(new URL("../../registry/svelte", import.meta.url)));

/** Vite's module id, with the drive letter in the same case as the real path. Windows otherwise loads Svelte twice. */
function viteFileId(id: string): string {
	const queryAt = id.indexOf("?");
	const file = queryAt === -1 ? id : id.slice(0, queryAt);
	const query = queryAt === -1 ? "" : id.slice(queryAt);
	return realpathSync.native(file).replaceAll("\\", "/") + query;
}

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
		// Load the same Svelte module the blocks use. A bare "svelte/server" import is a second copy on Windows
		// when the drive letter differs (E: vs e:), and snippet checks then fail instanceof.
		const svelteServer = await server.pluginContainer.resolveId("svelte/server");
		const resolved = typeof svelteServer === "string" ? svelteServer : svelteServer?.id;
		assert.ok(resolved, "svelte/server resolved");
		const { render } = (await server.ssrLoadModule(viteFileId(resolved))) as { render: (component: unknown, options: { props: Record<string, unknown> }) => { body: string } };
		const failures: string[] = [];
		let rendered = 0;
		const ids = catalogSnapshot.blockIndex.flatMap((entry) => entry.catalogIds);
		for (const id of ids) {
			const slash = id.indexOf("/");
			const hit = registryItemFor(id.slice(0, slash), id.slice(slash + 1));
			const organism = hit ? catalogSources.blocks[hit.item]?.organism : undefined;
			if (!hit || !organism) {
				failures.push(`${id}: stub`);
				continue;
			}
			try {
				const module = (await server.ssrLoadModule(`/src/${organism}`)) as { default: unknown };
				const body = render(module.default, { props: sampleProps(hit.item, hit.variant, "block-x") }).body;
				assert.ok(body.length > 0);
				rendered += 1;
			} catch (err) {
				failures.push(`${id} (${hit.item}): ${(err as Error).message.split("\n")[0]}`);
			}
		}
		assert.deepEqual(failures, []);
		assert.equal(rendered, 532);
	} finally {
		await server.close();
	}
});

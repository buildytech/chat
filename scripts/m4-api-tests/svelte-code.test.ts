import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parsePage } from "../../packages/page-contract/src/index.ts";
import { svelteFromPage, sveltePackFiles } from "../../apps/chat-web/src/lib/page-store/svelte-code.ts";

const fixture = JSON.parse(
	readFileSync(new URL("../../packages/page-contract/fixtures/north-harbor-kitchen.json", import.meta.url), "utf8")
) as unknown;
const page = parsePage(fixture);

test("Svelte Code describes the current page with UI8Kit imports", () => {
	const source = svelteFromPage(page, null);
	assert.match(source, /data-page-id="page-home"/);
	assert.match(source, /from "\$lib\/compose\/Block\.svelte"/);
	assert.match(source, /from "\.\/blocks\/block-hero\.svelte"/);
	assert.doesNotMatch(source, /\{layout /);
	assert.doesNotMatch(source, /page\.latte/);
});

test("Svelte pack files emit page.svelte not page.latte", () => {
	const files = sveltePackFiles(page, "block-hero");
	const names = files.map((file) => file.path);
	assert.ok(names.includes("page.svelte"));
	assert.ok(names.includes("blocks/block-hero.svelte"));
	assert.equal(names.includes("page.latte"), false);
	const hero = files.find((file) => file.path === "blocks/block-hero.svelte");
	assert.ok(hero);
	assert.match(hero!.content, /Harbor tables, seasonal plates/);
	assert.match(hero!.content, /from "\$ui\/button\/Button\.svelte"/);
});

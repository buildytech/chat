import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (file: string) =>
	readFileSync(new URL(`../../apps/chat-web/src/lib/screens/${file}.svelte`, import.meta.url), "utf8");

test("desktop panes never combine global hidden with responsive flex", () => {
	for (const name of ["Workspace", "ChatColumn", "ChatDrawer"]) {
		const s = source(name);
		assert.doesNotMatch(s, /: "hidden"/);
		assert.match(s, /max-lg:hidden/);
	}
});

test("Composer lists verified Grok chat ids and sends the selected model", () => {
	const s = source("ChatComposer");
	assert.match(s, /selectedModelId/);
	assert.match(s, /onSelectModel/);
	assert.match(s, /chatModels/);
	assert.match(s, /composer.modelList/);
	assert.match(s, /onSend\(text\)/);
	assert.doesNotMatch(s, /grok-imagine-image/);
});

test("Preview and Code consume the same page and saved revision store", () => {
	for (const name of ["PreviewPane", "CodePane"]) {
		const s = source(name);
		assert.match(s, /getCurrentPage\(\)/);
		assert.match(s, /getPageRevision\(\)/);
		assert.match(s, /data-page-revision/);
	}
});

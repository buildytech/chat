import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import {
	PREVIEW_CLEAN_KEY,
	parsePreviewClean,
	previewWindowUrl,
	serializePreviewClean
} from "../../apps/chat-web/src/lib/browser/preview-settings.ts";

const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");

test("clean preview setting round-trips and defaults to off", () => {
	assert.equal(PREVIEW_CLEAN_KEY, "buildy:v1:preview.hideServiceLabels");
	assert.equal(parsePreviewClean(null), false);
	assert.equal(parsePreviewClean("garbage"), false);
	assert.equal(parsePreviewClean(serializePreviewClean(true)), true);
	assert.equal(parsePreviewClean(serializePreviewClean(false)), false);
});

test("open in new window targets the standalone /preview route of the chat", () => {
	assert.equal(previewWindowUrl("s 1/x"), "/preview?session=s%201%2Fx");
	assert.equal(previewWindowUrl(null), "/preview");
	const pane = web("app/PreviewPane.svelte");
	assert.match(pane, /window\.open\(\s*previewWindowUrl\(/);
	assert.doesNotMatch(pane, /window\.open\(location\.href/);
});

test("/preview renders registry blocks only: no chat UI, no labels, read-only page store", () => {
	assert.ok(existsSync(new URL("../../apps/chat-web/src/routes/preview/+page.svelte", import.meta.url)));
	const route = web("routes/preview/+page.svelte");
	assert.match(route, /preview-frame\.css/);
	assert.doesNotMatch(route, /app\.css|ChatApp/);
	const view = web("app/StandalonePreview.svelte");
	assert.match(view, /<PreviewBlock \{block\} clean standalone \/>/);
	assert.match(view, /readPreviewPage/);
	assert.match(view, /theme\.init\(\)/);
	assert.doesNotMatch(view, /bindProject|ChatSidebar|ChatComposer|session\.svelte/);
	// Chat CSS stays with the chat route, so the standalone window gets the kit theme alone.
	assert.doesNotMatch(web("routes/+layout.svelte"), /import\s+"[^"]*app\.css"/);
	assert.match(web("routes/+page.svelte"), /app\.css/);
});

test("clean mode hides service labels in Preview, keeps Apply / Discard", () => {
	const pane = web("app/PreviewPane.svelte");
	assert.match(pane, /previewSettings\.hideServiceLabels/);
	assert.match(pane, /\{#if unapplied \|\| !clean\}/);
	assert.match(pane, /\{:else if appliedLabel && !clean\}/);
	const block = web("app/PreviewBlock.svelte");
	assert.match(block, /\{#if !clean\}\s*<Group[\s\S]*data-slot="block-provenance"/);
	assert.match(web("app/PreviewFrame.svelte"), /clean=\{previewSettings\.hideServiceLabels\}/);
	const sidebar = web("app/ChatSidebar.svelte");
	assert.match(sidebar, /\$registry\/compose\/Checkbox\.svelte/);
	assert.match(sidebar, /settings\.hidePreviewLabels/);
	for (const locale of ["en", "ru"]) {
		const messages = JSON.parse(web(`lib/i18n/${locale}.json`)).messages;
		for (const key of ["settings.hidePreviewLabels", "preview.standaloneTitle", "preview.standaloneEmpty"]) {
			assert.ok(messages[key], `${locale}: ${key}`);
		}
	}
});

test("Apply / Discard on a chat proposal card reach the session (were unwired)", () => {
	const message = web("app/ProposalDiff.svelte");
	assert.match(message, /onclick=\{\(\) => \(onApply \? onApply\(\) : applyProposal\(\)\)\}/);
	assert.match(message, /onclick=\{\(\) => \(onDiscard \? onDiscard\(\) : discardProposal\(\)\)\}/);
});

 test('friendly page addresses use the existing single-segment Page slug', async () => {
 const { pageSlug } = await import('../../apps/chat-web/src/lib/browser/page-address.ts');
 assert.equal(pageSlug('/marketing-landing'), 'marketing-landing');
 for (const value of ['/', '/about/team', 'https://example.com', '/api', '/runtime', '/preview', '/build', '/UPPER', '/a?x=1', 'a'.repeat(49)]) assert.equal(pageSlug(value), null, value);
 assert.equal(previewWindowUrl('s 1/x', '', 'marketing-landing'), '/marketing-landing?preview&session=s%201%2Fx');
 assert.equal(previewWindowUrl('s1', '/builder', 'home'), '/builder/home?preview&session=s1');
 });

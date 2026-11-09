import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (file: string) =>
	readFileSync(new URL(`../../apps/chat-web/src/lib/screens/${file}.svelte`, import.meta.url), "utf8");
const sessionCore = () =>
	readFileSync(new URL("../../apps/chat-web/src/lib/chat-core/session.svelte.ts", import.meta.url), "utf8");

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
	const preview = source("PreviewPane");
	assert.match(preview, /getCurrentProvenance/);
	assert.match(preview, /preview\.noScreen/);
	assert.doesNotMatch(preview, /lastProposal\?\.screenId/);
});

test("Code pane emits Svelte UI8Kit source, not Latte", () => {
	const s = source("CodePane");
	assert.match(s, /page\.svelte/);
	assert.match(s, /svelteFromPage/);
	assert.doesNotMatch(s, /page\.latte/);
	assert.doesNotMatch(s, /latteFromPage/);
});

test("Escape closes the model menu and Ctrl+K searches saved chats", () => {
	const composer = source("ChatComposer");
	assert.match(composer, /onEscape/);
	assert.match(composer, /svelte:window/);
	assert.match(composer, /modelOpen = false/);
	assert.match(composer, /composer-model-trigger/);
	assert.match(composer, /closeModelMenu/);
	assert.match(composer, /getElementById\("composer-model-trigger"\)\?\.focus/);
	assert.doesNotMatch(composer, /composer\.add"/);
	assert.match(composer, /composer\.addModel/);
	const sidebar = source("ChatSidebar");
	assert.match(sidebar, /sidebar-chat-search/);
	assert.match(sidebar, /ctrlKey/);
	assert.match(sidebar, /key === "Escape"/);
	assert.match(sidebar, /deleteAllSessions/);
	assert.match(sidebar, /setSelectedModelId/);
	assert.match(sidebar, /ConfirmDialog/);
	assert.match(sidebar, /pendingDelete/);
	assert.match(sidebar, /sidebar\.deleteAllConfirmBody/);
	assert.match(sidebar, /sidebar\.brandMark/);
	assert.doesNotMatch(sidebar, /function clearStorage/);
	assert.doesNotMatch(sidebar, /sidebar\.comingSoon/);
	assert.doesNotMatch(sidebar, /sidebar\.settingsSoon/);
	assert.doesNotMatch(sidebar, /<Block[\s\S]*<Block/);
});

test("Code pane copy reports success or failure", () => {
	const s = source("CodePane");
	assert.match(s, /navigator\.clipboard\.writeText/);
	assert.match(s, /code\.copyOk/);
	assert.match(s, /code\.copyFailed/);
	assert.match(s, /code\.copyEmpty/);
});

test("Stock search is a visible text filter, not only scenario chips", () => {
	const s = source("HomeOnboarding");
	assert.match(s, /setStockQuery/);
	assert.match(s, /stock-search/);
	assert.match(s, /home\.stockSearch/);
});

test("local session delete is enabled and removes pages", () => {
	const s = sessionCore();
	assert.match(s, /canDeleteSessions = \$state\(true\)/);
	assert.match(s, /export function deleteSession/);
	assert.match(s, /export function deleteAllSessions/);
	assert.match(s, /deleteSessionPages/);
	assert.match(s, /clearPagesBlob/);
});

test("narrow viewport uses Creator tabs, not only the preview device frame", () => {
	assert.match(source("CreatorTabs"), /lg:hidden/);
	assert.match(source("ChatColumn"), /max-lg:hidden/);
	assert.match(source("Workspace"), /max-lg:hidden/);
	assert.match(source("CreatorShell"), /mobileSurface/);
	assert.doesNotMatch(source("CreatorTopBar"), /shell\.publish/);
	assert.doesNotMatch(source("PreviewPane"), /preview\.editSoon/);
	assert.match(source("PreviewPane"), /missingLabels/);
});

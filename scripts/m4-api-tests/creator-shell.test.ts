import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const source = (file: string) =>
	readFileSync(new URL(`../../apps/chat-web/src/app/${file}.svelte`, import.meta.url), "utf8");
/** The chat modules and the project store (the former chat-core/session.svelte.ts, ADR 0040), one text. */
const sessionCore = () =>
	["chat-core/chat.svelte.ts", "chat-core/send.ts", "chat-core/proposal-flow.ts", "project/store.svelte.ts"]
		.map((file) => readFileSync(new URL(`../../apps/chat-web/src/lib/${file}`, import.meta.url), "utf8"))
		.join("\n");

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
	assert.match(s, /App\.svelte/);
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
	assert.doesNotMatch(sidebar, /setSelectedModelId/);
	assert.doesNotMatch(sidebar, /data-action="theme-toggle"/);
	assert.match(sidebar, /ConfirmDialog/);
	assert.match(sidebar, /pendingDelete/);
	assert.match(sidebar, /sidebar\.deleteAllConfirmBody/);
	assert.match(sidebar, /SquareRoundedLetterB/);
	assert.match(sidebar, /data-slot="brand-word"/);
	assert.doesNotMatch(sidebar, /Boxes/);
	const fonts = readFileSync(new URL("../../apps/chat-web/src/styles/fonts.css", import.meta.url), "utf8");
	assert.match(fonts, /font-family: "Google Sans"/);
	assert.match(fonts, /GoogleSans-latin\.woff2/);
	assert.match(fonts, /GoogleSans-cyrillic\.woff2/);
	assert.match(fonts, /GoogleSans-greek\.woff2/);
	for (const lang of ["en", "ru"]) {
		const dict = readFileSync(new URL(`../../apps/chat-web/src/lib/i18n/${lang}.json`, import.meta.url), "utf8");
		assert.match(dict, /"sidebar\.brand": "βuildγ"/, lang);
	}
	assert.match(sidebar, /\$lib\/shell-icons/);
	const appDir = new URL("../../apps/chat-web/src/app/", import.meta.url);
	for (const name of readdirSync(appDir)) {
		if (!name.endsWith(".svelte")) continue;
		assert.doesNotMatch(readFileSync(new URL(name, appDir), "utf8"), /@lucide\/svelte/, name);
	}
	assert.doesNotMatch(sidebar, /sidebar\.brandMark/);
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

test("Stock search lives on the Blocks feed; the chat home does not pick screens", () => {
	const feed = source("BlocksFeed");
	assert.match(feed, /feed-search/);
	assert.match(feed, /feed\.search/);
	const home = source("HomeOnboarding");
	assert.doesNotMatch(home, /setStockQuery|stock-search|selectScenario|attachScreen/);
});

test("local session delete is enabled and removes pages", () => {
	const s = sessionCore();
	assert.match(s, /canDeleteSessions: true/);
	assert.match(s, /export function deleteSession/);
	assert.match(s, /export function deleteAllSessions/);
	assert.match(s, /deleteProjectPage/);
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

test("first send from home does not attach a picked scenario or screen", () => {
	const s = sessionCore();
	const send = s.slice(s.indexOf("async function sendMessageMock"), s.indexOf("const userMsg"));
	assert.match(send, /session = await createSession\(\)/);
	assert.doesNotMatch(send, /scenarioId: getScenarioId\(\), screenId: getScreenId\(\)/);
});

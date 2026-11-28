/**
 * A long paste in the composer. The owner pasted a large text: the prompt grew to nearly the whole pane and the model list,
 * which opened above the whole form, went off the top of the window, so no model could be picked. The prompt is capped
 * (inner scroll) and the menus open above the actions row.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string): string => readFileSync(new URL(`../../apps/chat-web/src/modules/chat/${path}`, import.meta.url), "utf8");

test("the prompt has a fixed cap that is small next to the window, then scrolls inside", () => {
	const css = read("chat.css");
	const rule = css.split("\n").find((line) => line.startsWith("#composer {")) ?? "";
	assert.match(rule, /max-height: max\(4rem, min\(14rem, 40dvh\)\)/);
	assert.doesNotMatch(rule, /100dvh/, "no cap that follows the whole window");
	assert.match(read("ui/ChatComposer.svelte"), /overflow-y-auto[^"]*text-xs leading-4/, "the textarea scrolls inside");
});

test("the mode and model menus open above the actions row, inside it, never above the whole form", () => {
	const source = read("ui/ChatComposer.svelte");
	const actions = source.indexOf('data-slot="composer-actions"');
	const menus = source.indexOf('data-slot="composer-menus"');
	const modeList = source.indexOf('id="composer-mode-list"');
	const modelList = source.indexOf("<ComposerModelList");
	assert.ok(actions > 0 && menus > actions, "the menu anchor is inside the actions row");
	assert.ok(modeList > menus && modelList > menus, "both menus sit in that anchor");
	assert.match(source.slice(source.lastIndexOf("<Group", actions), actions), /\brelative\b/, "the actions row is the positioning parent");
	assert.match(read("ui/ComposerModelList.svelte"), /max-h-\[min\(16rem,50dvh\)\]/, "the list is also capped by the window");
});

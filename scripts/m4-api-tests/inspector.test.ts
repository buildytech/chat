/**
 * Build inspector (WP FastY Builder mechanics on the chat's own contracts): block identity on the canvas, editor
 * chrome drawn by the chat over the frame (never in the page), the schema-driven field model, validated write-back,
 * local history and block operations.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { PageBlock } from "../../packages/page-contract/src/index.ts";
import { blockSelector, overlayRect, sameRect, topLevelBlockId } from "../../apps/chat-web/src/lib/inspector/geometry.ts";

const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");

const tree: PageBlock[] = [
	{ id: "block-nav", kind: "nav", title: "Nav", summary: "n", children: [{ id: "block-nav-link-1", kind: "nav-link", title: "A", summary: "a" }] },
	{ id: "block-hero", kind: "hero", title: "Hero", summary: "h" }
];

test("canvas: a row selects its top-level block; unknown ids select nothing", () => {
	assert.equal(topLevelBlockId(tree, "block-hero"), "block-hero");
	assert.equal(topLevelBlockId(tree, "block-nav-link-1"), "block-nav");
	assert.equal(topLevelBlockId(tree, "nope"), null);
	assert.equal(topLevelBlockId(tree, null), null);
});

test("canvas: block selector quotes the id; overlay rects follow the frame scale and skip off-screen blocks", () => {
	assert.equal(blockSelector('a"b\\c'), '[data-block-id="a\\"b\\\\c"]');
	const viewport = { width: 1280, height: 800 };
	assert.deepEqual(overlayRect({ x: 0, y: 100, width: 1280, height: 400 }, 0.5, viewport), { x: 0, y: 50, width: 640, height: 200 });
	assert.equal(overlayRect({ x: 0, y: 900, width: 1280, height: 400 }, 1, viewport), null);
	assert.equal(overlayRect({ x: 0, y: -500, width: 1280, height: 400 }, 1, viewport), null);
	assert.equal(overlayRect({ x: 0, y: 0, width: 0, height: 0 }, 1, viewport), null);
	assert.ok(sameRect({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 4 }));
	assert.ok(!sameRect({ x: 1, y: 2, width: 3, height: 4 }, null));
});

test("canvas: blocks carry data-block-id; chrome lives in the chat document, not in the page", () => {
	const block = web("app/PreviewBlock.svelte");
	assert.match(block, /data-block-id=\{block\.id\}/);
	assert.doesNotMatch(block, /outline-/, "no selection outline inside the page");
	assert.match(block, /onpointerenter=\{standalone \? undefined/);
	const pane = web("app/PreviewPane.svelte");
	assert.match(pane, /\{#if frameDoc && !clean\}\s*<CanvasOverlay/);
	const overlay = web("app/CanvasOverlay.svelte");
	assert.match(overlay, /getBoundingClientRect/);
	assert.match(overlay, /MutationObserver/);
	assert.match(overlay, /ResizeObserver/);
	assert.match(overlay, /addEventListener\("scroll"/);
	assert.doesNotMatch(overlay, /\sstyle=/, "geometry is set by an attachment, not a style attribute");
	assert.doesNotMatch(web("app/StandalonePreview.svelte"), /CanvasOverlay|BlockTree/);
	const workspace = web("app/Workspace.svelte");
	assert.match(workspace, /\{#if build\}\s*<BlockTree \/>/);
	assert.match(web("app/BlockTree.svelte"), /canvas\.hover\(block\.id\)/);
});

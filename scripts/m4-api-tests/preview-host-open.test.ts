/**
 * Opening the standalone preview (ADR 0073). The owner's desktop address http://wails.localhost/home?preview&session=…
 * did not open: window.open in a Wails webview makes a popup the asset server does not serve. The desktop host opens it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { openPreviewWindow, setPreviewHostOpener } from "../../apps/chat-web/src/lib/browser/preview-window.ts";
import { hostOpensPreview, noteRuntimePreview } from "../../apps/chat-web/src/modules/chat/browser/runtime-preview.ts";
import { importThemeConfig } from "../../apps/chat-web/src/lib/theme/custom-skin.ts";
import { previewWindowUrl } from "../../apps/chat-web/src/lib/browser/preview-settings.ts";

const SESSION = "session-b066e122-c354-492d-9464-d3c3cc4b95e1";
const URL_OF_PAGE = previewWindowUrl(SESSION, "", "home");

test("the owner's address is what the app builds", () => {
	assert.equal(URL_OF_PAGE, `/home?preview&session=${SESSION}`);
	assert.equal(previewWindowUrl(SESSION), `/preview?session=${SESSION}`);
});

test("a browser (no host opener) opens the preview itself and never calls the host", async () => {
	setPreviewHostOpener(null);
	const opened: string[] = [];
	assert.equal(await openPreviewWindow(URL_OF_PAGE, { open: (url) => opened.push(url) }), "browser");
	assert.deepEqual(opened, [URL_OF_PAGE]);
});

test("the desktop host opens the window: one POST with the in-app address, no window.open", async () => {
	const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
	const send = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
	}) as unknown as typeof fetch;
	assert.equal(await hostOpensPreview(URL_OF_PAGE, send), true);
	assert.equal(calls.length, 1);
	assert.equal(calls[0]!.url, "/runtime/v1/preview-window");
	assert.equal(calls[0]!.init?.method, "POST");
	assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), { path: URL_OF_PAGE });
	// registered from the status: a desktop host takes it, nothing is passed to window.open
	setPreviewHostOpener(async (url) => hostOpensPreview(url, send));
	const opened: string[] = [];
	assert.equal(await openPreviewWindow(URL_OF_PAGE, { open: (url) => opened.push(url) }), "host");
	assert.deepEqual(opened, [], "a webview popup is what failed");
	setPreviewHostOpener(null);
});

test("a host that cannot open a window (the headless build: 501), fails or is unreachable falls back to the browser", async () => {
	const answers = [
		() => new Response(JSON.stringify({ error: { code: "unsupported" } }), { status: 501 }),
		() => new Response("nope", { status: 502 }),
		() => {
			throw new Error("network");
		}
	];
	for (const respond of answers) {
		const send = (async () => respond()) as unknown as typeof fetch;
		setPreviewHostOpener(async (url) => hostOpensPreview(url, send));
		const opened: string[] = [];
		assert.equal(await openPreviewWindow(URL_OF_PAGE, { open: (url) => opened.push(url) }), "browser");
		assert.deepEqual(opened, [URL_OF_PAGE]);
	}
	setPreviewHostOpener(null);
});

test("the status registers the opener only for a desktop host", async () => {
	const opened: string[] = [];
	noteRuntimePreview({ kind: "desktop", version: "0.1.2", os: "windows", arch: "amd64" });
	const originalFetch = globalThis.fetch;
	let called = 0;
	globalThis.fetch = (async () => {
		called += 1;
		return new Response(JSON.stringify({ ok: true }), { status: 200 });
	}) as unknown as typeof fetch;
	try {
		assert.equal(await openPreviewWindow(URL_OF_PAGE, { open: (url) => opened.push(url) }), "host");
		noteRuntimePreview(undefined);
		assert.equal(await openPreviewWindow(URL_OF_PAGE, { open: (url) => opened.push(url) }), "browser");
	} finally {
		globalThis.fetch = originalFetch;
		setPreviewHostOpener(null);
	}
	assert.equal(called, 1, "a browser host never asks the host");
	assert.deepEqual(opened, [URL_OF_PAGE]);
});

test("wiring: the Preview pane's open-in-new-window goes through openPreviewWindow, not window.open", () => {
	const pane = readFileSync(new URL("../../apps/chat-web/src/app/PreviewPane.svelte", import.meta.url), "utf8");
	assert.match(pane, /void openPreviewWindow\(previewWindowUrl\(/);
	assert.doesNotMatch(pane, /window\.open\(/);
	const client = readFileSync(new URL("../../apps/chat-web/src/modules/chat/browser/xai-client.ts", import.meta.url), "utf8");
	assert.match(client, /noteRuntimePreview\(body\.host\)/);
	const core = readFileSync(new URL("../../apps/chat-web/src/lib/browser/preview-window.ts", import.meta.url), "utf8");
	assert.doesNotMatch(core, /runtime\/v1/, "the core names no runtime path: chat-off builds carry none (no-trace)");
});

test("the preview window reads the Brand Skin of its session from storage, without a hydrated project store", async () => {
	const { useStorageForTests, saveSessionsJson } = await import("../../apps/chat-web/src/lib/browser/persist.ts");
	const { readStoredProject } = await import("../../apps/chat-web/src/lib/project/stored.ts");
	const { themeOfProjectSkin } = await import("../../apps/chat-web/src/lib/theme/brand-skins.ts");
	const map = new Map<string, string>();
	useStorageForTests({
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => void map.set(key, value),
		removeItem: (key: string) => void map.delete(key)
	});
	const imported = importThemeConfig(readFileSync(new URL("./fixtures/stock-theme-export.json", import.meta.url), "utf8"));
	assert.ok(imported.ok);
	const theme = { ...imported.config, palette: { harmony: "complementary" as const, h: 24, s: 88, l: 52 } };
	const record = { id: "brand-titan", name: "TITAN", revision: 2, source: "design", createdAt: "2026-11-28T11:00:00.000Z", updatedAt: "2026-11-28T11:05:00.000Z", brief: { name: "TITAN", thesis: { summary: "s", positioning: "p", antiPersonality: [] }, grammar: {} }, theme };
	assert.ok(saveSessionsJson([{ id: SESSION, title: "New page", updatedAt: "2026-11-28T11:05:00.000Z", skin: "brand-titan", ext: { design: { skins: { "brand-titan": record } } } }]));
	const before = JSON.stringify([...map.entries()]);
	const project = readStoredProject(SESSION);
	assert.equal(project?.skin, "brand-titan");
	assert.equal(themeOfProjectSkin(project, project?.skin)?.palette?.h, 24, "the stored skin's theme is found by the session id");
	assert.equal(readStoredProject("session-unknown"), null);
	assert.equal(readStoredProject(null), null);
	assert.equal(JSON.stringify([...map.entries()]), before, "read-only: nothing written");
	assert.match(readFileSync(new URL("../../apps/chat-web/src/lib/theme/custom-skin.svelte.ts", import.meta.url), "utf8"), /getProject\(sessionId\) \?\? readStoredProject\(sessionId\)/);
});

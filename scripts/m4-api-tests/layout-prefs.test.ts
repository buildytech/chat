/**
 * Shell layout prefs (ADR 0017): buildy:v1:prefs persistence and the one-time move of buildy:v1:layout, size
 * clamping, keyboard steps, viewport fitting (the canvas keeps PREVIEW_MIN while a panel can give width), focus mode,
 * shortcuts, and the session file `prefs` (session.schema.json 1.2.0).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	clampSize,
	defaultLayout,
	fitWidths,
	isCollapsed,
	keyStep,
	PANE_RANGE,
	parseLayout,
	PREVIEW_MIN,
	RAIL,
	withCollapsed,
	withSize,
	type LayoutPrefs
} from "../../apps/chat-web/src/lib/layout/prefs.ts";
import { loadLayout, saveLayout } from "../../apps/chat-web/src/lib/layout/prefs-store.ts";
import { shortcutFor } from "../../apps/chat-web/src/lib/layout/shortcuts.ts";
import { readQuarantine, STORAGE_KEYS } from "../../apps/chat-web/src/lib/browser/storage-v1.ts";
import { sessionFileIssues } from "../../packages/page-contract/src/session.ts";

class MemoryStorage {
	map = new Map<string, string>();
	refuse = false;
	getItem(key: string) {
		return this.map.has(key) ? this.map.get(key)! : null;
	}
	setItem(key: string, value: string) {
		if (this.refuse) throw new Error("QuotaExceededError");
		this.map.set(key, String(value));
	}
	removeItem(key: string) {
		this.map.delete(key);
	}
}

test("defaults: canvas first (nav as a rail), every size inside its range", () => {
	const layout = defaultLayout();
	assert.equal(layout.navCollapsed, true);
	assert.equal(layout.chatCollapsed, false);
	assert.equal(layout.inspectorCollapsed, false);
	for (const [pane, range] of Object.entries(PANE_RANGE)) {
		assert.ok(range.min <= range.default && range.default <= range.max, pane);
		assert.equal(range.default % 8, 0, `${pane} default on the 8px grid`);
	}
});

test("resize clamping: below min, above max, fractions, NaN and strings", () => {
	const { min, max, default: def } = PANE_RANGE.chat;
	assert.equal(clampSize("chat", min - 100), min);
	assert.equal(clampSize("chat", max + 100), max);
	assert.equal(clampSize("chat", 300.4), 300);
	assert.equal(clampSize("chat", Number.NaN), def);
	assert.equal(clampSize("chat", "400"), def, "strings are not sizes");
	const layout = defaultLayout();
	assert.equal(withSize(layout, "inspector", 10_000).inspectorWidth, PANE_RANGE.inspector.max);
	assert.equal(withSize(layout, "layers", 0).layersHeight, PANE_RANGE.layers.min);
	assert.equal(withSize(layout, "chat", layout.chatWidth), layout, "unchanged size: same object (no write)");
	assert.equal(keyStep(false), 8);
	assert.equal(keyStep(true), 32);
});

test("parseLayout keeps known valid fields, clamps sizes, drops the rest", () => {
	const parsed = parseLayout({ chatWidth: 9999, inspectorWidth: 1, focus: true, chatCollapsed: "yes", panel: 3, layersCollapsed: true });
	assert.equal(parsed.chatWidth, PANE_RANGE.chat.max);
	assert.equal(parsed.inspectorWidth, PANE_RANGE.inspector.min);
	assert.equal(parsed.focus, true);
	assert.equal(parsed.chatCollapsed, false, "non-boolean flag ignored");
	assert.equal(parsed.layersCollapsed, true);
	assert.ok(!("panel" in parsed));
	for (const bad of [null, 7, "x", []]) assert.deepEqual(parseLayout(bad), defaultLayout());
});

test("persistence: save then load round-trips; one key buildy:v1:prefs", () => {
	const store = new MemoryStorage();
	let layout: LayoutPrefs = withSize(withCollapsed(defaultLayout(), "inspector", true), "chat", 400);
	assert.equal(saveLayout(store, layout), true);
	assert.deepEqual([...store.map.keys()], [STORAGE_KEYS.prefs]);
	assert.deepEqual(loadLayout(store), layout);
	layout = { ...layout, focus: true };
	saveLayout(store, layout);
	assert.equal(loadLayout(store).focus, true);
	store.refuse = true;
	assert.equal(saveLayout(store, defaultLayout()), false, "a refused write reports false");
	assert.equal(loadLayout(null).navCollapsed, true, "no storage: defaults");
});

test("migration: buildy:v1:layout moves once into prefs and is removed; unreadable prefs are quarantined", () => {
	const store = new MemoryStorage();
	store.setItem(STORAGE_KEYS.layout, JSON.stringify({ navWidth: 300, chatWidth: 360, treeWidth: 220, sidebarCollapsed: false, chatHidden: true, treeCollapsed: true }));
	const moved = loadLayout(store);
	assert.equal(moved.navWidth, 300);
	assert.equal(moved.chatWidth, 360);
	assert.equal(moved.treeWidth, 220);
	assert.equal(moved.navCollapsed, false);
	assert.equal(moved.chatCollapsed, true);
	assert.equal(moved.treeCollapsed, true);
	assert.equal(store.getItem(STORAGE_KEYS.layout), null, "old key removed");
	assert.deepEqual(JSON.parse(store.getItem(STORAGE_KEYS.prefs)!).layout, moved);
	assert.deepEqual(loadLayout(store), moved, "idempotent");

	const broken = new MemoryStorage();
	broken.setItem(STORAGE_KEYS.prefs, "{not json");
	assert.deepEqual(loadLayout(broken), defaultLayout());
	const q = readQuarantine(broken);
	assert.equal(q.length, 1);
	assert.equal(q[0]!.reason, "prefs_unreadable");
	assert.equal(q[0]!.raw, "{not json");
});

test("fitWidths: stored widths at a wide window; chat then inspector give way so the canvas keeps PREVIEW_MIN", () => {
	const layout = { ...defaultLayout(), navCollapsed: false };
	const wide = fitWidths({ viewport: 1920, layout, inspector: true, columns: true });
	assert.deepEqual([wide.nav, wide.chat, wide.inspector], [layout.navWidth, layout.chatWidth, layout.inspectorWidth]);
	const tight = fitWidths({ viewport: 1024, layout: { ...layout, chatWidth: 520, inspectorWidth: 480 }, inspector: true, columns: true });
	assert.ok(tight.chat >= PANE_RANGE.chat.min && tight.inspector >= PANE_RANGE.inspector.min);
	assert.equal(tight.chat, PANE_RANGE.chat.min, "chat gives first");
	assert.equal(tight.nav + tight.chat + tight.inspector + tight.preview, 1024);
	// 1024 with the chat collapsed (Wails window): rail + rail + inspector, the canvas well above the minimum.
	const desk = fitWidths({ viewport: 1024, layout: { ...defaultLayout(), chatCollapsed: true }, inspector: true, columns: true });
	assert.deepEqual([desk.nav, desk.chat], [RAIL, RAIL]);
	assert.ok(desk.preview >= 600, `preview ${desk.preview}`);
	// Below lg nav and chat take no width; Ask has no inspector.
	assert.equal(fitWidths({ viewport: 800, layout, inspector: false, columns: false }).preview, 800);
});

test("focus mode shows every shell panel as a rail without forgetting the stored states", () => {
	const layout = { ...defaultLayout(), navCollapsed: false, focus: true };
	for (const panel of ["nav", "chat", "inspector"] as const) assert.equal(isCollapsed(layout, panel), true, panel);
	assert.equal(isCollapsed(layout, "layers"), false, "inside the inspector nothing changes");
	assert.equal(isCollapsed({ ...layout, focus: false }, "nav"), false, "stored state comes back");
	const fit = fitWidths({ viewport: 1440, layout, inspector: true, columns: true });
	assert.equal(fit.preview, 1440 - 3 * RAIL);
});

test("shortcuts: Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+\\ by physical key; not with Alt/Shift or inside the code editor", () => {
	const ev = (code: string, extra: Record<string, unknown> = {}) => ({ key: "", code, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, target: null, ...extra });
	assert.equal(shortcutFor(ev("KeyB")), "chat");
	assert.equal(shortcutFor(ev("KeyI", { ctrlKey: false, metaKey: true })), "inspector");
	assert.equal(shortcutFor(ev("Backslash")), "focus");
	assert.equal(shortcutFor(ev("KeyB", { ctrlKey: false })), null);
	assert.equal(shortcutFor(ev("KeyB", { altKey: true })), null);
	assert.equal(shortcutFor(ev("KeyI", { shiftKey: true })), null);
	assert.equal(shortcutFor(ev("KeyI", { target: { closest: (s: string) => (s === ".cm-editor" ? {} : null) } })), null);
	assert.equal(shortcutFor(ev("KeyK")), null);
});

test("session file prefs (1.2.0): the stored layout is schema-valid; out-of-range or unknown fields are not", () => {
	const base = {
		$schema: "https://schema.buildy.tw/session.schema.json",
		format: "buildy:v1",
		exportedAt: "2026-11-10T12:00:00.000Z",
		app: { name: "buildy-chat", version: "0.5.0", host: "browser" },
		pins: { stock: { repo: "codegen-x/ui8kit", contentCommit: "081a1c5e5cc5db6f6439a37edb666ddfee7aa006" }, registry: { url: "https://registry.buildy.tw", sourceCommit: "3a6d923a3bdf75bba8951a3dfda7f3e97a69ecc5" } },
		selectedSessionId: null,
		sessions: []
	};
	assert.deepEqual(sessionFileIssues(base), [], "a file without prefs stays valid");
	assert.deepEqual(sessionFileIssues({ ...base, prefs: { layout: defaultLayout() } }), []);
	assert.notDeepEqual(sessionFileIssues({ ...base, prefs: { layout: { chatWidth: 1.5 } } }), []);
	assert.notDeepEqual(sessionFileIssues({ ...base, prefs: { layout: { dock: "left" } } }), []);
	assert.notDeepEqual(sessionFileIssues({ ...base, prefs: { theme: "dark" } }), []);
});

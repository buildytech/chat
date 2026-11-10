/**
 * Layout shortcuts (ADR 0017): Ctrl/Cmd+B chat column, Ctrl/Cmd+I inspector, Ctrl/Cmd+\ preview-only focus.
 * Not inside the code editor (CodeMirror binds Mod-i) and never with Alt (keyboard layouts type characters with it).
 */
export type ShortcutAction = "chat" | "inspector" | "focus";

type KeyLike = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"> & { target?: EventTarget | null };

export function shortcutFor(event: KeyLike): ShortcutAction | null {
	if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return null;
	const target = event.target as { closest?: (selector: string) => unknown } | null | undefined;
	if (target && typeof target.closest === "function" && target.closest(".cm-editor")) return null;
	// `code` keeps the shortcut on the same physical key in every keyboard layout.
	if (event.code === "KeyB") return "chat";
	if (event.code === "KeyI") return "inspector";
	if (event.code === "Backslash") return "focus";
	return null;
}

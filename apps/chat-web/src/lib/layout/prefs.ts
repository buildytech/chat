/**
 * Layout preferences of this browser (ADR 0017): pane sizes and collapsed states of the creator shell, stored under
 * `buildy:v1:prefs` (`{ layout }`) and carried by the session file as `prefs` (session.schema.json 1.2.0). Pure: no
 * Svelte, no DOM. Every value read from storage or a file is clamped to its range, so a bad value never breaks the shell.
 */

/** Width of a collapsed side panel (the rail with its icon buttons). */
export const RAIL = 48;
/** The canvas never gets narrower than this while a side panel can still give up width. */
export const PREVIEW_MIN = 360;
/** Widths (px) of the vertical panes and the height of the Layers part of the inspector. */
export const PANE_RANGE = {
	nav: { min: 200, max: 360, default: 240 },
	chat: { min: 264, max: 520, default: 320 },
	inspector: { min: 256, max: 480, default: 304 },
	layers: { min: 96, max: 480, default: 200 },
	tree: { min: 144, max: 360, default: 208 }
} as const;

export type Pane = keyof typeof PANE_RANGE;
/** Side panels that collapse to a rail (`tree` is the Code view's file tree). */
export type Panel = "nav" | "chat" | "inspector" | "layers" | "tree";

export type LayoutPrefs = {
	navWidth: number;
	chatWidth: number;
	inspectorWidth: number;
	layersHeight: number;
	treeWidth: number;
	navCollapsed: boolean;
	chatCollapsed: boolean;
	inspectorCollapsed: boolean;
	layersCollapsed: boolean;
	treeCollapsed: boolean;
	/** Preview-only mode (Ctrl+\): every side panel shows as a rail; the stored states come back when it ends. */
	focus: boolean;
};

export type PrefsBlob = { layout: LayoutPrefs };

const WIDTH_KEY: Record<Pane, keyof LayoutPrefs> = {
	nav: "navWidth",
	chat: "chatWidth",
	inspector: "inspectorWidth",
	layers: "layersHeight",
	tree: "treeWidth"
};
const COLLAPSED_KEY: Record<Panel, keyof LayoutPrefs> = {
	nav: "navCollapsed",
	chat: "chatCollapsed",
	inspector: "inspectorCollapsed",
	layers: "layersCollapsed",
	tree: "treeCollapsed"
};

/** Canvas first: the nav starts as a rail; chat and inspector open at their default widths. */
export function defaultLayout(): LayoutPrefs {
	return {
		navWidth: PANE_RANGE.nav.default,
		chatWidth: PANE_RANGE.chat.default,
		inspectorWidth: PANE_RANGE.inspector.default,
		layersHeight: PANE_RANGE.layers.default,
		treeWidth: PANE_RANGE.tree.default,
		navCollapsed: true,
		chatCollapsed: false,
		inspectorCollapsed: false,
		layersCollapsed: false,
		treeCollapsed: false,
		focus: false
	};
}

/** Round and clamp a size to the pane's range; anything that is not a finite number is the default. */
export function clampSize(pane: Pane, value: unknown): number {
	const range = PANE_RANGE[pane];
	const n = typeof value === "number" ? value : Number.NaN;
	if (!Number.isFinite(n)) return range.default;
	return Math.min(range.max, Math.max(range.min, Math.round(n)));
}

export const sizeKey = (pane: Pane): keyof LayoutPrefs => WIDTH_KEY[pane];
export const collapsedKey = (panel: Panel): keyof LayoutPrefs => COLLAPSED_KEY[panel];

export function sizeOf(layout: LayoutPrefs, pane: Pane): number {
	return layout[WIDTH_KEY[pane]] as number;
}

export function withSize(layout: LayoutPrefs, pane: Pane, value: number): LayoutPrefs {
	const next = clampSize(pane, value);
	return sizeOf(layout, pane) === next ? layout : { ...layout, [WIDTH_KEY[pane]]: next };
}

export function withCollapsed(layout: LayoutPrefs, panel: Panel, collapsed: boolean): LayoutPrefs {
	return layout[COLLAPSED_KEY[panel]] === collapsed ? layout : { ...layout, [COLLAPSED_KEY[panel]]: collapsed };
}

/** Collapsed as shown: focus mode shows every side panel of the shell as a rail. */
export function isCollapsed(layout: LayoutPrefs, panel: Panel): boolean {
	if (layout.focus && panel !== "layers" && panel !== "tree") return true;
	return layout[COLLAPSED_KEY[panel]] as boolean;
}

/** Any object (stored blob, file, partial) -> a complete, clamped layout. Unknown fields are dropped. */
export function parseLayout(input: unknown): LayoutPrefs {
	const base = defaultLayout();
	if (!input || typeof input !== "object" || Array.isArray(input)) return base;
	const raw = input as Record<string, unknown>;
	const out = { ...base };
	for (const pane of Object.keys(PANE_RANGE) as Pane[]) {
		const key = WIDTH_KEY[pane];
		if (key in raw) (out[key] as number) = clampSize(pane, raw[key]);
	}
	for (const panel of Object.keys(COLLAPSED_KEY) as Panel[]) {
		const key = COLLAPSED_KEY[panel];
		if (typeof raw[key] === "boolean") (out[key] as boolean) = raw[key] as boolean;
	}
	if (typeof raw.focus === "boolean") out.focus = raw.focus;
	return out;
}

/** The layout of the previous key `buildy:v1:layout` (navWidth, chatWidth, treeWidth, sidebarCollapsed, chatHidden, treeCollapsed). */
export function layoutFromLegacy(input: unknown): LayoutPrefs {
	const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
	return parseLayout({
		navWidth: raw.navWidth,
		chatWidth: raw.chatWidth,
		treeWidth: raw.treeWidth,
		...(typeof raw.sidebarCollapsed === "boolean" ? { navCollapsed: raw.sidebarCollapsed } : {}),
		...(typeof raw.chatHidden === "boolean" ? { chatCollapsed: raw.chatHidden } : {}),
		...(typeof raw.treeCollapsed === "boolean" ? { treeCollapsed: raw.treeCollapsed } : {})
	});
}

/** Stored text -> prefs; null when absent or unreadable (the caller quarantines unreadable text). */
export function parsePrefsText(text: string | null): PrefsBlob | null {
	if (text == null) return null;
	try {
		const parsed: unknown = JSON.parse(text);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
		return { layout: parseLayout((parsed as { layout?: unknown }).layout) };
	} catch {
		return null;
	}
}

export type FitInput = {
	viewport: number;
	layout: LayoutPrefs;
	/** Build shows the inspector column; Ask and Code do not. */
	inspector: boolean;
	/** Below lg the chat is a tab and the nav a drawer: they take no width next to the workspace. */
	columns: boolean;
};

export type FitWidths = { nav: number; chat: number; inspector: number; preview: number };

/**
 * The widths the shell renders at this viewport. Stored sizes are wishes: when the canvas would get less than
 * PREVIEW_MIN, the chat and then the inspector give up width down to their minimums (stored values are untouched, so
 * a wider window gets them back). Collapsed panels are rails.
 */
export function fitWidths({ viewport, layout, inspector, columns }: FitInput): FitWidths {
	const nav = !columns ? 0 : isCollapsed(layout, "nav") ? RAIL : layout.navWidth;
	let chat = !columns ? 0 : isCollapsed(layout, "chat") ? 0 : layout.chatWidth;
	let insp = !inspector ? 0 : isCollapsed(layout, "inspector") ? RAIL : layout.inspectorWidth;
	let over = nav + chat + insp + PREVIEW_MIN - viewport;
	const give = (width: number, min: number, rail: boolean) => {
		if (over <= 0 || rail) return width;
		const cut = Math.min(over, width - min);
		over -= cut;
		return width - cut;
	};
	chat = give(chat, PANE_RANGE.chat.min, chat === RAIL || chat === 0);
	insp = give(insp, PANE_RANGE.inspector.min, insp === RAIL || insp === 0);
	return { nav, chat, inspector: insp, preview: Math.max(0, viewport - nav - chat - insp) };
}

/** Keyboard step of a separator: 8px, 32px with Shift (the 8px layout grid). */
export const keyStep = (shift: boolean): number => (shift ? 32 : 8);

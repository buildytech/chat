/**
 * The creator shell layout (ADR 0017): pane sizes and collapsed states from `buildy:v1:prefs`, the viewport, and the
 * widths that fit it. Rules live in `layout/prefs.ts` (pure, tested); this module holds the state and persists it.
 */
import { browserStorage } from "./browser/storage-v1.ts";
import { loadLayout, saveLayout } from "./layout/prefs-store.ts";
import {
	collapsedKey,
	fitWidths,
	isCollapsed,
	parseLayout,
	PANE_RANGE,
	sizeOf,
	withCollapsed,
	withSize,
	type LayoutPrefs,
	type Pane,
	type Panel
} from "./layout/prefs.ts";

/** Breakpoints of the shell: columns from lg (the left panel is a tab below). INSPECTOR_COLUMN_MIN now only sizes the Code file tree (ADR 0024: the inspector is a slide-over at every width). */
const COLUMNS_MIN = 1024;
export const INSPECTOR_COLUMN_MIN = 768;

export type CreatorLayoutPane = Pane;

/** The body carries the drag state (cursor and selection rules in CSS). */
function markResizing(on: boolean, axis: "x" | "y"): void {
	if (typeof document === "undefined") return;
	document.body.classList.toggle("creator-resizing", on);
	document.body.dataset.resizeAxis = axis;
}

function createCreatorLayout() {
	let layout = $state<LayoutPrefs>(loadLayout(browserStorage()));
	let viewport = $state(typeof window === "undefined" ? 1440 : window.innerWidth);
	let resizing = $state(false);
	// The workspace view: the inspector column exists only in Build on the Preview tab.
	let view = $state<"preview" | "code">("preview");

	function persist() {
		saveLayout(browserStorage(), layout);
	}

	function set(next: LayoutPrefs, save = true) {
		if (next === layout) return;
		layout = next;
		if (save) persist();
	}

	/** Collapse or expand one panel. Expanding a panel ends focus mode (keeps the other stored states). */
	function setCollapsed(panel: Panel, collapsed: boolean) {
		let next = layout;
		if (!collapsed && next.focus) next = { ...next, focus: false };
		set(withCollapsed(next, panel, collapsed));
	}

	function toggle(panel: Panel) {
		setCollapsed(panel, !isCollapsed(layout, panel));
	}

	const columns = () => viewport >= COLUMNS_MIN;

	return {
		get layout() {
			return layout;
		},
		get viewport() {
			return viewport;
		},
		get resizing() {
			return resizing;
		},
		get focus() {
			return layout.focus;
		},
		get columns() {
			return columns();
		},
		/** Widths as rendered now (stored wishes fitted to the viewport; rails for collapsed panels). ADR 0024: the inspector is a slide-over, never a third column. */
		get widths() {
			return fitWidths({ viewport, layout, inspector: false, columns: columns() });
		},
		setViewport(width: number) {
			viewport = Math.round(width);
		},
		get view() {
			return view;
		},
		set view(next: "preview" | "code") {
			view = next;
		},
		size(pane: Pane): number {
			return sizeOf(layout, pane);
		},
		/** Set a pane size (clamped). Drag moves call it with save=false and save once on release. */
		setSize(pane: Pane, value: number, save = true) {
			set(withSize(layout, pane, value), save);
		},
		resetSize: (pane: Pane) => set(withSize(layout, pane, PANE_RANGE[pane].default)),
		save: persist,
		collapsed(panel: Panel): boolean {
			return isCollapsed(layout, panel);
		},
		setCollapsed,
		toggle,
		toggleFocus: () => set({ ...layout, focus: !layout.focus }),
		/** Whole layout from a session file (`prefs.layout`), clamped. */
		replace(input: unknown) {
			set(parseLayout(input));
		},
		setResizing(next: boolean, axis: "x" | "y" = "x") {
			resizing = next;
			markResizing(next, axis);
		},
		// Code view file tree (kept names for CodePane).
		get treeCollapsed() {
			return layout[collapsedKey("tree")] as boolean;
		},
		toggleTree: () => toggle("tree")
	};
}

export const creatorLayout = createCreatorLayout();

/**
 * The creator shell layout (ADR 0017): pane sizes and collapsed states from `buildy:v1:prefs`, the viewport, and the
 * widths that fit it. Rules live in `layout/prefs.ts` (pure, tested); this module holds the state and persists it.
 */
import { STORAGE_KEYS, browserStorage } from "./browser/storage-v1.ts";
import { editorMode } from "./modules/registry.svelte.ts";
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

export const PREFS_KEY = STORAGE_KEYS.prefs;
/** Breakpoints of the shell: columns from lg (the left panel is a tab below). INSPECTOR_COLUMN_MIN now only sizes the Code file tree (ADR 0024: the inspector is a slide-over at every width). */
export const COLUMNS_MIN = 1024;
export const INSPECTOR_COLUMN_MIN = 768;

export type CreatorLayoutPane = Pane;

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
	// ADR 0024: Build is two areas (left panel | preview). The inspector is no longer a third column at any width; it
	// opens as a slide-over on the preview (the Workspace sheet), the shape step D of the plan refines.
	const inspectorColumn = () => false;

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
		get inspectorColumn() {
			return inspectorColumn();
		},
		/** Widths as rendered now (stored wishes fitted to the viewport; rails for collapsed panels). */
		get widths() {
			return fitWidths({ viewport, layout, inspector: editorMode() === "build" && view === "preview" && inspectorColumn(), columns: columns() });
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
		resetSize(pane: Pane) {
			set(withSize(layout, pane, PANE_RANGE[pane].default));
		},
		save: persist,
		collapsed(panel: Panel): boolean {
			return isCollapsed(layout, panel);
		},
		setCollapsed,
		toggle,
		toggleFocus() {
			set({ ...layout, focus: !layout.focus });
		},
		/** Whole layout from a session file (`prefs.layout`), clamped. */
		replace(input: unknown) {
			set(parseLayout(input));
		},
		setResizing(next: boolean, axis: "x" | "y" = "x") {
			resizing = next;
			if (typeof document === "undefined") return;
			document.body.classList.toggle("creator-resizing", next);
			document.body.dataset.resizeAxis = axis;
		},
		// Code view file tree (kept names for CodePane).
		get treeCollapsed() {
			return layout[collapsedKey("tree")] as boolean;
		},
		toggleTree() {
			toggle("tree");
		}
	};
}

export const creatorLayout = createCreatorLayout();

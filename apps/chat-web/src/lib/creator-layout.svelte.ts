export const CREATOR_LAYOUT_KEY = "buildy.creator.layout";

export const CREATOR_LAYOUT_DEFAULTS = {
	navWidth: 248,
	chatWidth: 320,
	treeWidth: 208
} as const;

export const CREATOR_LAYOUT_CLAMP = {
	nav: { min: 180, max: 360 },
	chat: { min: 240, max: 480 },
	tree: { min: 140, max: 360 }
} as const;

export const CREATOR_NAV_RAIL = 64;

export type CreatorLayoutPane = keyof typeof CREATOR_LAYOUT_CLAMP;

type CreatorLayoutBlob = {
	navWidth: number;
	chatWidth: number;
	treeWidth: number;
	sidebarCollapsed: boolean;
	chatHidden: boolean;
	treeCollapsed: boolean;
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.round(value)));
}

function asNumber(value: unknown, min: number, max: number, fallback: number): number {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return fallback;
	return clamp(n, min, max);
}

function asBool(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function readBlob(): CreatorLayoutBlob {
	const fallback: CreatorLayoutBlob = {
		navWidth: CREATOR_LAYOUT_DEFAULTS.navWidth,
		chatWidth: CREATOR_LAYOUT_DEFAULTS.chatWidth,
		treeWidth: CREATOR_LAYOUT_DEFAULTS.treeWidth,
		sidebarCollapsed: false,
		chatHidden: false,
		treeCollapsed: false
	};
	if (typeof localStorage === "undefined") return fallback;
	try {
		const raw = localStorage.getItem(CREATOR_LAYOUT_KEY);
		if (!raw) return fallback;
		const parsed = JSON.parse(raw) as Partial<CreatorLayoutBlob>;
		return {
			navWidth: asNumber(
				parsed.navWidth,
				CREATOR_LAYOUT_CLAMP.nav.min,
				CREATOR_LAYOUT_CLAMP.nav.max,
				fallback.navWidth
			),
			chatWidth: asNumber(
				parsed.chatWidth,
				CREATOR_LAYOUT_CLAMP.chat.min,
				CREATOR_LAYOUT_CLAMP.chat.max,
				fallback.chatWidth
			),
			treeWidth: asNumber(
				parsed.treeWidth,
				CREATOR_LAYOUT_CLAMP.tree.min,
				CREATOR_LAYOUT_CLAMP.tree.max,
				fallback.treeWidth
			),
			sidebarCollapsed: asBool(parsed.sidebarCollapsed, fallback.sidebarCollapsed),
			chatHidden: asBool(parsed.chatHidden, fallback.chatHidden),
			treeCollapsed: asBool(parsed.treeCollapsed, fallback.treeCollapsed)
		};
	} catch {
		return fallback;
	}
}

function createCreatorLayout() {
	const initial = readBlob();
	let navWidth = $state(initial.navWidth);
	let chatWidth = $state(initial.chatWidth);
	let treeWidth = $state(initial.treeWidth);
	let sidebarCollapsed = $state(initial.sidebarCollapsed);
	let chatHidden = $state(initial.chatHidden);
	let treeCollapsed = $state(initial.treeCollapsed);
	let resizing = $state(false);

	function persist() {
		if (typeof localStorage !== "undefined") {
			const blob: CreatorLayoutBlob = {
				navWidth,
				chatWidth,
				treeWidth,
				sidebarCollapsed,
				chatHidden,
				treeCollapsed
			};
			localStorage.setItem(CREATOR_LAYOUT_KEY, JSON.stringify(blob));
		}
		syncCssVars();
	}

	function widthOf(pane: CreatorLayoutPane): number {
		if (pane === "nav") return navWidth;
		if (pane === "chat") return chatWidth;
		return treeWidth;
	}

	function setWidth(pane: CreatorLayoutPane, next: number, shouldPersist = true) {
		const range = CREATOR_LAYOUT_CLAMP[pane];
		const value = clamp(next, range.min, range.max);
		if (pane === "nav") navWidth = value;
		else if (pane === "chat") chatWidth = value;
		else treeWidth = value;
		if (shouldPersist) persist();
		else syncCssVars();
	}

	function resetWidth(pane: CreatorLayoutPane) {
		if (pane === "nav") setWidth("nav", CREATOR_LAYOUT_DEFAULTS.navWidth);
		else if (pane === "chat") setWidth("chat", CREATOR_LAYOUT_DEFAULTS.chatWidth);
		else setWidth("tree", CREATOR_LAYOUT_DEFAULTS.treeWidth);
	}

	function setResizing(next: boolean) {
		resizing = next;
		if (typeof document === "undefined") return;
		document.body.classList.toggle("creator-resizing", next);
	}

	function syncCssVars() {
		if (typeof document === "undefined") return;
		const widthNav = `${sidebarCollapsed ? CREATOR_NAV_RAIL : navWidth}px`;
		const widthChat = `${chatWidth}px`;
		const widthTree = `${treeWidth}px`;
		const apply = (node: HTMLElement) => {
			node.style.setProperty("--creator-nav-w", widthNav);
			node.style.setProperty("--creator-chat-w", widthChat);
			node.style.setProperty("--creator-tree-w", widthTree);
		};
		apply(document.documentElement);
		const shell = document.getElementById("creator-shell");
		if (shell) apply(shell);
	}

	return {
		get navWidth() {
			return navWidth;
		},
		get chatWidth() {
			return chatWidth;
		},
		get treeWidth() {
			return treeWidth;
		},
		get sidebarCollapsed() {
			return sidebarCollapsed;
		},
		get chatHidden() {
			return chatHidden;
		},
		get treeCollapsed() {
			return treeCollapsed;
		},
		get resizing() {
			return resizing;
		},
		widthOf,
		setWidth,
		resetWidth,
		setResizing,
		syncCssVars,
		toggleSidebar() {
			sidebarCollapsed = !sidebarCollapsed;
			persist();
		},
		toggleChat() {
			chatHidden = !chatHidden;
			persist();
		},
		toggleTree() {
			treeCollapsed = !treeCollapsed;
			persist();
		}
	};
}

export const creatorLayout = createCreatorLayout();
creatorLayout.syncCssVars();

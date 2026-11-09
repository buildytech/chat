/**
 * Canonical Page DTO (layout.version 1).
 *
 * This is a structured page layout document, not a Codex v0.4 entry.
 * Codex records and this DTO stay distinct; do not treat `kind` here as a CMS kind.
 *
 * Preview (Svelte) and Code (generated Svelte UI8Kit source) project the same `layout.blocks` tree.
 * Ordinary pages only: unique slug, no UTM/multilanding, no commerce fields.
 */

export const PAGE_LAYOUT_VERSION = 1 as const;

/** Closed allowlist from implemented Preview components (PreviewBlock / PreviewItem). */
export const PAGE_BLOCK_KINDS = [
	"nav",
	"nav-link",
	"hero",
	"features",
	"feature",
	"menu",
	"dish",
	"hours",
	"cta",
	"footer",
	"pagehead",
	"overview",
	"metrics",
	"metric",
	"chart",
	"activity",
	"activity-item",
	"sidenav",
	"bottomnav"
] as const;

export type PageBlockKind = (typeof PAGE_BLOCK_KINDS)[number];

/**
 * Copy keys projected by Preview and the generated Svelte Code pane.
 * Values are opaque plain-text strings, never executable markup.
 * `value` is a display figure on a metric tile or chart point (text, e.g. "128" or "94%").
 * `badge` is a short marker such as a demo-data label; the author can edit or delete it.
 */
export const PAGE_COPY_KEYS = [
	"eyebrow",
	"headline",
	"lede",
	"action",
	"note",
	"brand",
	"contact",
	"legal",
	"days",
	"address",
	"value",
	"badge"
] as const;

export type PageCopyKey = (typeof PAGE_COPY_KEYS)[number];

export type PageBlockCopy = {
	[K in PageCopyKey]?: string;
};

/** Aligns with PagePort lifecycle; draft creation is explicit via parseDraftPage. */
export const PAGE_STATUSES = [
	"draft",
	"pending",
	"scheduled",
	"published",
	"archived",
	"trashed"
] as const;

export type PageStatus = (typeof PAGE_STATUSES)[number];

export const PAGE_LIMITS = {
	maxBlocks: 64,
	maxDepth: 4,
	maxIdLength: 63,
	maxSlugLength: 48,
	maxTitleLength: 160,
	maxSummaryLength: 500,
	maxCopyLength: 2000,
	maxSeoLength: 200,
	maxLocaleLength: 16,
	maxJsonChars: 65_536
} as const;

export type PageSeo = {
	title?: string;
	description?: string;
};

export type PageBlock = {
	id: string;
	kind: PageBlockKind;
	title: string;
	summary: string;
	copy?: PageBlockCopy;
	children?: PageBlock[];
};

export type PageLayout = {
	version: typeof PAGE_LAYOUT_VERSION;
	blocks: PageBlock[];
};

export type Page = {
	id: string;
	slug: string;
	status: PageStatus;
	title: string;
	layout: PageLayout;
	seo: PageSeo;
	locale: string;
	createdAt: string;
	updatedAt: string;
};

/** Alias used by Creator Workspace; same object as Page. */
export type CreatorPage = Page;

export type PageSummary = Pick<Page, "id" | "slug" | "status" | "title" | "updatedAt">;

export function blocksOf(page: Page): PageBlock[] {
	return page.layout.blocks;
}

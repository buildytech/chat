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
 * `icon` is a Lucide icon name (checked against the pinned registry snapshot); `href` is the link of `action`
 * (#fragment, /path, http(s) or mailto). Both page-spec 1.1.0.
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
	"badge",
	"icon",
	"href"
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

/** Lengths of the page-spec 1.1.0 catalog fields (catalogBlock, variant, copy.icon). */
export const PAGE_CATALOG_LIMITS = {
	maxCatalogBlockLength: 80,
	maxVariantLength: 40,
	maxIconLength: 64
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
	/**
	 * Stock catalog block asset this block was built from (`block.<name>`), page-spec 1.1.0. The host checks it
	 * against the pinned catalog; Preview and Code render its registry organism when the snapshot has one.
	 */
	catalogBlock?: string;
	/** Catalog variant of catalogBlock (`block.<name>/<variant>` is the catalog asset id), page-spec 1.1.0. */
	variant?: string;
	copy?: PageBlockCopy;
	/**
	 * Props overrides of a top-level block (page-spec 1.3.0): JSON Pointer of a prop of the registry item its catalog
	 * variant renders (`/actions/secondary`, `/content/features`) -> plain JSON value. Merged over the variant preset and
	 * the page content; the host validates the merged props against the item's props schema (props_invalid).
	 */
	props?: Record<string, PagePropValue>;
	children?: PageBlock[];
};

/** A props override value (page-spec 1.3.0): plain JSON; strings are page safe text. */
export type PagePropValue = string | number | boolean | null | PagePropValue[] | { [key: string]: PagePropValue };

/** Limits of block props overrides (page-spec 1.3.0, PAGE_PROPS_LIMITS_V1 of the contract). */
export const PAGE_PROPS_LIMITS = { maxEntries: 64, maxPointerLength: 200, maxListItems: 24, maxObjectKeys: 32 } as const;
export const PAGE_PROPS_POINTER_PATTERN = /^(?:\/(?:[A-Za-z][A-Za-z0-9_]{0,47}|[0-9]{1,2}))+$/;

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

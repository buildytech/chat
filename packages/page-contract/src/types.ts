/**
 * The block kind vocabulary of the Stock catalog (the renderer kinds a catalog block or a screen slot is classified as).
 * The page-spec/v1 page model (layout.version 1, copy slots, props overrides) is gone: a page is page-spec/v2 (./v2.ts)
 * and v1 data is refused, not converted (ADR 0045). The kind list is read by the catalog generator
 * (scripts/lib/catalog-artifacts.mjs), which is why it stays a literal array here.
 */

/** Closed allowlist of renderer kinds. */
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

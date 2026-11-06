/**
 * Local view of the Page DTO for Creator Workspace stubs.
 * Shape matches `packages/page-contract` plus required title on each node (ADR-0003).
 */

export type PageStatus =
	| "draft"
	| "pending"
	| "scheduled"
	| "published"
	| "archived"
	| "trashed";

/** Ordinary landing kinds used by the mock Page DTO. Unknown kinds still render. */
export type PageBlockKind =
	| "nav"
	| "nav-link"
	| "hero"
	| "features"
	| "feature"
	| "menu"
	| "dish"
	| "hours"
	| "cta"
	| "footer"
	| (string & {});

/** Opaque copy fields projected into Preview and Latte. No promo/stock/UTM. */
export type PageBlockCopy = {
	eyebrow?: string;
	headline?: string;
	lede?: string;
	action?: string;
	note?: string;
	brand?: string;
	contact?: string;
	legal?: string;
	days?: string;
	address?: string;
};

export type PageBlock = {
	id: string;
	kind: PageBlockKind;
	title: string;
	summary: string;
	copy?: PageBlockCopy;
	children?: PageBlock[];
};

export type CreatorPage = {
	id: string;
	slug: string;
	status: PageStatus;
	title: string;
	layout: {
		version: 1;
		blocks: PageBlock[];
	};
	seo: {
		title?: string;
		description?: string;
	};
	locale: string;
	createdAt: string;
	updatedAt: string;
};

export function blocksOf(page: CreatorPage): PageBlock[] {
	return page.layout.blocks;
}

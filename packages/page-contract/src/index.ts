/**
 * Page DTO shared by the visual Builder and SI Chat.
 *
 * P0: ordinary `page` kind + unique slug. No multilanding, UTM, checkout,
 * fabricated discounts, or stock fields.
 */

/** Lifecycle of a stored page. Aligns with Codex v0.4 entry statuses we actually use. */
export type PageStatus =
	| "draft"
	| "pending"
	| "scheduled"
	| "published"
	| "archived"
	| "trashed";

/** SEO extras stored with the page. All optional; never invent promo copy. */
export type PageSeo = {
	title?: string;
	description?: string;
};

/**
 * One node in `layout.blocks`. Children are ordered nested sections or items.
 * `kind` is a renderer key (hero, features, cta, …). Copy is opaque strings.
 */
export type PageBlock = {
	id: string;
	kind: string;
	title?: string;
	summary?: string;
	copy?: Record<string, string>;
	children?: PageBlock[];
};

/**
 * Layout payload. Both builders read/write the same Page Store.
 * PreviewPort (Svelte) and CodePort (Latte) project this tree (ADR-0003).
 */
export type PageLayout = {
	version: 1;
	blocks: PageBlock[];
};

export type Page = {
	/** Stable id (`page-<n>` or UUID). Never reused after delete. */
	id: string;
	/** Unique among pages. P0: one slug, no UTM variants. */
	slug: string;
	status: PageStatus;
	title: string;
	layout: PageLayout;
	seo: PageSeo;
	/** BCP 47, e.g. `ru`. */
	locale: string;
	createdAt: string;
	updatedAt: string;
};

export type PageSummary = Pick<Page, "id" | "slug" | "status" | "title" | "updatedAt">;

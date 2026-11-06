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
 * Layout payload. Opaque to chat-web: both builders read/write the same
 * Page Store. Chat does not interpret block internals in this scaffold.
 */
export type PageLayout = {
	version: 1;
	blocks: unknown[];
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

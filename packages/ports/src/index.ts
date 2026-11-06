/**
 * CMS-agnostic ports. Adapters (WordPress, FastyGo, Wails, …) implement these.
 * apps/chat-web must not import WordPress PHP or WP REST types.
 */
import type { Page, PageSummary } from "@buildytech/page-contract";

export type { Page, PageSummary } from "@buildytech/page-contract";

/** List pages in the shared Page Store. */
export interface CatalogPort {
	listPages(query?: { locale?: string; status?: Page["status"] }): Promise<PageSummary[]>;
}

/** Load and persist a single page. */
export interface PagePort {
	getPage(id: string): Promise<Page | null>;
	getPageBySlug(slug: string): Promise<Page | null>;
	savePage(page: Page): Promise<Page>;
}

/** Publish / unpublish without inventing commerce state. */
export interface PublishPort {
	publish(id: string): Promise<Page>;
	unpublish(id: string): Promise<Page>;
}

/** Preview URL for an unpublished or published page. */
export interface PreviewPort {
	previewUrl(id: string): Promise<string>;
}

export type PageStorePorts = {
	catalog: CatalogPort;
	page: PagePort;
	publish: PublishPort;
	preview: PreviewPort;
};

/**
 * CMS-agnostic ports. Host adapters implement these.
 * apps/chat-web talks to ports over HTTP or the local mock, never to CMS internals.
 */
import type { PageV2 as Page } from "@buildytech/page-contract";

export type { PageV2 as Page } from "@buildytech/page-contract";

/** A row of the page list. */
export type PageSummary = Pick<Page, "id" | "slug" | "title" | "locale" | "status" | "updatedAt">;

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

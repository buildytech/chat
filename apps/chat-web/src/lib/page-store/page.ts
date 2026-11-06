/**
 * Local view of the Page DTO for Creator Workspace stubs.
 * Shape matches `packages/page-contract` plus typed layout.blocks (ADR-0003).
 */

export type PageStatus =
	| "draft"
	| "pending"
	| "scheduled"
	| "published"
	| "archived"
	| "trashed";

export type PageBlock = {
	id: string;
	kind: string;
	title: string;
	summary: string;
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

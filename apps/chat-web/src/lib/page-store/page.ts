/**
 * Creator Workspace view of the canonical page document: page-spec/v2 (ADR 0034). One document equals what the export
 * emits: { title, slug, locale, seo, blocks: [{ id, item, variant, props }] }. Types and runtime validation live in
 * `@buildytech/page-contract`; the gate that judges a write is `writePage` in builder-core.
 */
import { parsePageV2, type BlockV2, type PageStatusV2, type PageV2 } from "@buildytech/page-contract";

export type Page = PageV2;
export type CreatorPage = PageV2;
export type PageBlock = BlockV2;
export type PageStatus = PageStatusV2;

export const parsePage = parsePageV2;
export const parseDraftPage = parsePageV2;

/** The blocks of a page, in order. */
export function blocksOf(page: Pick<PageV2, "blocks">): BlockV2[] {
	return page.blocks;
}

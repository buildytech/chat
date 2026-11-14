/**
 * Page spec page-spec/v2 and page patch page-patch/v2, published by @ui8kit/contract
 * (https://schema.buildy.tw/page-spec-v2.schema.json, https://schema.buildy.tw/page-patch-v2.schema.json), ADR 0034.
 * A page is one document `{ version: 2, title, slug, locale, seo, blocks: [{ id, item, variant, props }] }`: `item` is
 * the registry item of `npx ui8kit add`, `props` exactly the props of its component. No kind, copy slots, children or
 * screen family. The schemas are vendored in ../schema (`npm run schema:check` compares them with the live URLs).
 * This module holds the schema gate and the program checks; the registry checks (item, variant, props schema, header /
 * footer) live in builder-core `page-doc`, where the registry data is.
 */
import pageSpecV2Schema from "../schema/page-spec-v2.schema.json" with { type: "json" };
import pagePatchV2Schema from "../schema/page-patch-v2.schema.json" with { type: "json" };
import pageSpecSchema from "../schema/page-spec.schema.json" with { type: "json" };
import { SchemaRegistry, type SchemaIssue } from "./json-schema.ts";

export class PageContractError extends Error {
	readonly code: string;
	readonly path: string;

	constructor(code: string, path: string, message: string) {
		super(`${code} at ${path}: ${message}`);
		this.name = "PageContractError";
		this.code = code;
		this.path = path;
	}
}

export const PAGE_SPEC_V2_SCHEMA_URL = "https://schema.buildy.tw/page-spec-v2.schema.json";
export const PAGE_PATCH_V2_SCHEMA_URL = "https://schema.buildy.tw/page-patch-v2.schema.json";
export const PAGE_DOCUMENT_VERSION = 2 as const;

export const PAGE_V2_LIMITS = (pageSpecV2Schema as { "x-limits": { maxBlocks: number; maxJsonChars: number; maxDepth: number; maxIdLength: number; maxListItems: number; maxPropKeys: number } })["x-limits"];
export const PAGE_PATCH_V2_LIMITS = (pagePatchV2Schema as { "x-limits": { maxOps: number } })["x-limits"];

export type PropValueV2 = string | number | boolean | null | PropValueV2[] | { [key: string]: PropValueV2 };
export type PageStatusV2 = "draft" | "pending" | "scheduled" | "published" | "archived" | "trashed";
/** One section: a registry item, the variant it was picked as and its props (exactly the component's props). */
export type BlockV2 = { id: string; item: string; variant?: string; props?: Record<string, PropValueV2> };
/** A page-spec/v2 document. `id`, `status`, `createdAt`, `updatedAt` are host-managed (optional in the document). */
export type PageV2 = {
	version: typeof PAGE_DOCUMENT_VERSION;
	id?: string;
	slug: string;
	status?: PageStatusV2;
	title: string;
	locale: string;
	seo?: { title?: string; description?: string };
	createdAt?: string;
	updatedAt?: string;
	blocks: BlockV2[];
};
/** An RFC 6902 operation of a page-patch/v2. */
export type PatchOpV2 = { op: "add" | "replace" | "test"; path: string; value: unknown } | { op: "remove"; path: string } | { op: "move" | "copy"; from: string; path: string };

const registry = new SchemaRegistry();
registry.add(pageSpecSchema as Record<string, unknown>);
registry.add(pageSpecV2Schema as Record<string, unknown>);
registry.add(pagePatchV2Schema as Record<string, unknown>);

export { pagePatchV2Schema, pageSpecV2Schema };

/** Schema issues of a page-spec/v2 document. Empty = the shape is valid; run pageV2ProgramIssues next. */
export function pageV2Issues(input: unknown): SchemaIssue[] {
	return registry.check(input, PAGE_SPEC_V2_SCHEMA_URL);
}

/** Schema issues against a page-spec/v2 $def (block, props, record, ...). */
export function pageV2DefIssues(input: unknown, def: "block" | "props" | "record" | "page"): SchemaIssue[] {
	return registry.check(input, `${PAGE_SPEC_V2_SCHEMA_URL}#/$defs/${def}`);
}

/** Schema issues of an RFC 6902 page patch. */
export function pagePatchV2Issues(input: unknown): SchemaIssue[] {
	return registry.check(input, PAGE_PATCH_V2_SCHEMA_URL);
}

function depthOf(value: unknown, depth = 0): number {
	if (value === null || typeof value !== "object") return depth;
	const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
	return children.reduce<number>((max, child) => Math.max(max, depthOf(child, depth + 1)), depth);
}

/** Program checks (x-program-checks) after the schema: duplicate ids, block count, size, props depth. */
export function pageV2ProgramIssues(page: PageV2): SchemaIssue[] {
	const out: SchemaIssue[] = [];
	const seen = new Set<string>();
	if (page.id) seen.add(page.id);
	page.blocks.forEach((block, index) => {
		if (seen.has(block.id)) out.push({ path: `$.blocks[${index}].id`, keyword: "duplicate_id", expected: "an id no other block (or the page) uses" });
		seen.add(block.id);
		if (block.props && depthOf(block.props) > PAGE_V2_LIMITS.maxDepth) out.push({ path: `$.blocks[${index}].props`, keyword: "too_deep", expected: `props nested at most ${PAGE_V2_LIMITS.maxDepth} levels` });
	});
	if (page.blocks.length > PAGE_V2_LIMITS.maxBlocks) out.push({ path: "$.blocks", keyword: "too_many_blocks", expected: `at most ${PAGE_V2_LIMITS.maxBlocks} blocks` });
	if (JSON.stringify(page).length > PAGE_V2_LIMITS.maxJsonChars) out.push({ path: "$", keyword: "too_large", expected: `at most ${PAGE_V2_LIMITS.maxJsonChars} characters of JSON` });
	return out;
}

/** Strict gate of a page-spec/v2 document: the published schema, then the program checks (throws PageContractError). */
export function parsePageV2(input: unknown): PageV2 {
	const issues = pageV2Issues(input);
	if (issues.length) throw new PageContractError("page_spec_invalid", issues[0]!.path, `page-spec/v2 ${issues[0]!.keyword} failed`);
	const page = input as PageV2;
	const program = pageV2ProgramIssues(page);
	if (program.length) throw new PageContractError(program[0]!.keyword, program[0]!.path, `page-spec/v2 ${program[0]!.keyword}`);
	return page;
}

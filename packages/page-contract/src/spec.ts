/**
 * Page spec page-spec/v1 and edit operations page-patch/v1, published by @ui8kit/contract
 * (https://schema.buildy.tw/page-spec.schema.json, https://schema.buildy.tw/page-patch.schema.json).
 * The schemas are vendored in ../schema (byte-identical to the contract commit below; `npm run schema:check`
 * compares them with the live URLs). The browser, the runtime and Lab validate the same documents.
 */
import pageSpecSchema from "../schema/page-spec.schema.json" with { type: "json" };
import pagePatchSchema from "../schema/page-patch.schema.json" with { type: "json" };
import { SchemaRegistry, type SchemaIssue } from "./json-schema.ts";
import { PageContractError, parseDraftPage, parsePage } from "./validate.ts";
import type { Page, PageBlockKind, PageCopyKey } from "./types.ts";

export const PAGE_SPEC_SCHEMA_URL = "https://schema.buildy.tw/page-spec.schema.json";
export const PAGE_PATCH_SCHEMA_URL = "https://schema.buildy.tw/page-patch.schema.json";
/** ui8kit/contract commit the vendored schemas come from. */
export const PAGE_SPEC_SCHEMA_SOURCE = { repo: "ui8kit/contract", commit: "fa09858" } as const;

const registry = new SchemaRegistry();
registry.add(pageSpecSchema as Record<string, unknown>);
registry.add(pagePatchSchema as Record<string, unknown>);

export { pagePatchSchema, pageSpecSchema, type SchemaIssue };

export type PageSlot = { copy: PageCopyKey[]; items?: { kind: PageBlockKind; max: number; fields: string[] } };
/** Copy keys each kind renders and the rows of list kinds (schema x-page-slots). */
export const PAGE_SLOTS = (pageSpecSchema as { "x-page-slots": Record<PageBlockKind, PageSlot> })["x-page-slots"];

/** Schema issues of a page (root of page-spec). Empty = the shape is valid; run parsePage for program checks. */
export function pageSpecIssues(input: unknown): SchemaIssue[] {
	return registry.check(input, PAGE_SPEC_SCHEMA_URL);
}

/** Schema issues against a page-spec $def (provenance, record, store). */
export function pageSpecDefIssues(input: unknown, def: "provenance" | "record" | "store"): SchemaIssue[] {
	return registry.check(input, `${PAGE_SPEC_SCHEMA_URL}#/$defs/${def}`);
}

export function pagePatchIssues(input: unknown): SchemaIssue[] {
	return registry.check(input, PAGE_PATCH_SCHEMA_URL);
}

/**
 * Page spec gate: the published schema first (code page_spec_invalid with the first schema path),
 * then parsePage for the program checks (duplicate ids, block count, size) and the normalized copy.
 */
export function parsePageSpec(input: unknown, options: { draft?: boolean } = {}): Page {
	const issues = pageSpecIssues(input);
	if (issues.length) {
		const first = issues[0]!;
		throw new PageContractError("page_spec_invalid", first.path, `page-spec/v1 ${first.keyword} failed`);
	}
	return options.draft ? parseDraftPage(input) : parsePage(input);
}

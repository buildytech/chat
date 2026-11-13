export {
	PAGE_BLOCK_KINDS,
	PAGE_CATALOG_LIMITS,
	PAGE_COPY_KEYS,
	PAGE_LAYOUT_VERSION,
	PAGE_LIMITS,
	PAGE_PROPS_LIMITS,
	PAGE_PROPS_POINTER_PATTERN,
	PAGE_STATUSES,
	blocksOf,
	type CreatorPage,
	type Page,
	type PageBlock,
	type PageBlockCopy,
	type PageBlockKind,
	type PageCopyKey,
	type PageLayout,
	type PagePropValue,
	type PageSeo,
	type PageStatus,
	type PageSummary
} from "./types.ts";
export { isPage, PageContractError, parseDraftPage, parsePage } from "./validate.ts";
export {
	PAGE_PATCH_SCHEMA_URL,
	PAGE_SLOTS,
	PAGE_SPEC_SCHEMA_SOURCE,
	PAGE_SPEC_SCHEMA_URL,
	pagePatchIssues,
	pagePatchSchema,
	pageSpecDefIssues,
	pageSpecIssues,
	pageSpecSchema,
	parsePageSpec,
	type PageSlot,
	type SchemaIssue
} from "./spec.ts";
export { SchemaRegistry } from "./json-schema.ts";
// Session profile buildy:v1 is its own entry (@buildytech/page-contract/session) so the runtime bundle does not carry it.
export {
	PAGE_DOCUMENT_VERSION,
	PAGE_PATCH_V2_LIMITS,
	PAGE_PATCH_V2_SCHEMA_URL,
	PAGE_SPEC_V2_SCHEMA_URL,
	PAGE_V2_LIMITS,
	pagePatchV2Issues,
	pagePatchV2Schema,
	pageV2DefIssues,
	pageV2Issues,
	pageV2ProgramIssues,
	pageSpecV2Schema,
	parsePageV2,
	type BlockV2,
	type PageStatusV2,
	type PageV2,
	type PatchOpV2,
	type PropValueV2
} from "./v2.ts";

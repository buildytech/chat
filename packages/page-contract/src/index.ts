export { PAGE_BLOCK_KINDS, type PageBlockKind } from "./types.ts";
export { SchemaRegistry, type SchemaIssue } from "./json-schema.ts";
// Session profile buildy:v1 is its own entry (@buildytech/page-contract/session) so the runtime bundle does not carry it.
export {
	PageContractError,
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

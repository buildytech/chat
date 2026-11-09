import { pageSpecIssues } from "@buildytech/page-contract";
import type { LayoutProposal } from "./assemble.ts";
import { recordedScreenId } from "./assemble.ts";
import { validateCatalogProvenance, type CatalogValidationError } from "./catalog/provenance.ts";

export type PageSpecGateError = { ok: false; code: "page_spec_invalid"; message: string; path?: string };

/**
 * The browser's program-level gate for a proposal (never the model): the published page-spec/v1
 * schema (https://schema.buildy.tw/page-spec.schema.json), then catalog refs recomputed from the
 * bundled Stock catalog. The chat UI and the regression tests call this same function, so an
 * assembler output the UI would reject fails in CI first.
 */
export function clientProposalGate(
	proposal: Pick<LayoutProposal, "page" | "provenance">
): ReturnType<typeof validateCatalogProvenance> | PageSpecGateError | CatalogValidationError {
	const issues = pageSpecIssues(proposal.page);
	if (issues.length) {
		const first = issues[0]!;
		return { ok: false, code: "page_spec_invalid", message: `page-spec/v1 ${first.keyword} failed at ${first.path}`, path: first.path };
	}
	return validateCatalogProvenance({
		page: proposal.page,
		screenId: recordedScreenId(proposal.provenance.screenId),
		catalogDigest: proposal.provenance.catalog?.sourceDigest ?? null
	});
}

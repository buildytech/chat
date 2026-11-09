import type { LayoutProposal } from "./assemble.ts";
import { recordedScreenId } from "./assemble.ts";
import { validateCatalogProvenance } from "./catalog/provenance.ts";

/**
 * The browser's program-level catalog gate for a proposal (never the model): recompute catalog
 * refs from the bundled Stock catalog. The chat UI and the regression tests call this same
 * function, so an assembler output the UI would reject fails in CI first.
 */
export function clientProposalGate(proposal: Pick<LayoutProposal, "page" | "provenance">) {
	return validateCatalogProvenance({
		page: proposal.page,
		screenId: recordedScreenId(proposal.provenance.screenId),
		catalogDigest: proposal.provenance.catalog?.sourceDigest ?? null
	});
}

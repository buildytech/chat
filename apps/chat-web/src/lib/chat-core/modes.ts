/**
 * Ask / Build chat modes (ADR-0011): pure logic, no DOM, no runes. The author picks the mode in the composer; it is
 * stored per chat. Ask turns answer in text and never touch the page; the Apply variant action on an Ask block card
 * switches the chat to Build and creates an ordinary set_variant proposal (pending until the author applies it).
 */
import {
	askBlockCard,
	editPage,
	isAgentMode,
	isAgentTextReply,
	type AgentMode,
	type AgentTextReply,
	type LayoutProposal,
	type LayoutProposalError
} from "@buildytech/builder-core";
import type { Page } from "@buildytech/page-contract";
import type { ChatSession } from "./types";

export const DEFAULT_CHAT_MODE: AgentMode = "build";

/** Mode of a chat: its stored choice, else the choice made before the chat existed, else Build. */
export function chatModeOf(session: Pick<ChatSession, "mode"> | null | undefined, pending?: AgentMode | null): AgentMode {
	if (session && isAgentMode(session.mode)) return session.mode;
	return isAgentMode(pending) ? pending : DEFAULT_CHAT_MODE;
}

/** What a finished turn produced: a text answer (no proposal), a proposal, or an error. */
export function turnOutcome(result: { ok: boolean } | AgentTextReply): "text" | "proposal" | "error" {
	if (isAgentTextReply(result)) return "text";
	return result.ok ? "proposal" : "error";
}

export type VariantTarget = { ok: true; blockId: string; spec: string } | { ok: false; code: "no_page" | "unknown_block" | "block_not_on_page" };

/**
 * The top-level page block an Ask card's variant applies to: the block of that catalog spec, else the first block of
 * the same page kind. The variant itself is checked by editPage against the pinned catalog.
 */
export function variantTarget(page: Page | null | undefined, spec: string): VariantTarget {
	if (!page) return { ok: false, code: "no_page" };
	const card = askBlockCard(spec);
	if (!card) return { ok: false, code: "unknown_block" };
	const blocks = page.layout.blocks;
	const hit = blocks.find((block) => block.catalogBlock === card.spec) ?? (card.kind ? blocks.find((block) => block.kind === card.kind) : undefined);
	return hit ? { ok: true, blockId: hit.id, spec: card.spec } : { ok: false, code: "block_not_on_page" };
}

/** Apply variant from an Ask card: one page-patch/v1 set_variant op through the same editPage as model edits. */
export function variantProposal(input: {
 scopeBlockIds?: string[];
	page: Page | null | undefined;
	provenance?: { screenId: string | null; scenarioId: "dashboard" | "landing" | "website" | null; missing: string[] } | null;
	revision: number;
	spec: string;
	variant: string;
	sessionDemoData?: boolean;
}): LayoutProposal | LayoutProposalError {
	const target = variantTarget(input.page, input.spec);
	if (!target.ok) {
		return { ok: false, code: target.code, message: target.code };
	}
	return editPage({
		scopeBlockIds: input.scopeBlockIds,
 page: input.page!,
		provenance: input.provenance ?? undefined,
		patch: { baseRevision: input.revision, ops: [{ op: "set_variant", blockId: target.blockId, variant: input.variant }] },
		expectedRevision: input.revision,
		sessionDemoData: Boolean(input.sessionDemoData),
		liveTurn: false
	});
}

/**
 * Proposals of the chat: Apply and Discard of the pending candidate (Build; Ask is read-only). The page operations are the project store's
 * (`applyPending`, `discardPending`, `startEmptyProject`); the chat marks its messages. Apply is blocked when a block the
 * proposal touches was edited by hand on the applied page since its turn started (baseHash, t85u).
 */
import { staleBlocks } from "@buildytech/chat-agent";
import { t } from "../../../lib/i18n/dictionary";
import { getLastAppliedPage } from "../../../lib/page-store";
import { applyPending, discardPending } from "../../../lib/project/store.svelte.ts";
import { commitSession, getSelectedSession, run } from "./chat.svelte.ts";
import { isPendingProposal, markPendingProposals } from "./proposals";
import { nowIso } from "./turn";
import type { ChatSession } from "./types";

/** The block ids of the latest pending Build proposal that changed on the applied page since its turn started. */
export function staleForApply(session: ChatSession | null): string[] {
	const latest = [...(session?.messages ?? [])].reverse().find((m) => m.mode !== "ask" && m.proposal && isPendingProposal(m.proposal));
	const base = latest ? session?.proposalBases?.[latest.id] : undefined;
	return base ? staleBlocks(getLastAppliedPage(), base.applied) : [];
}

export function applyProposal(): boolean {
	const stale = staleForApply(getSelectedSession());
	if (stale.length) {
		run.lastError = t("proposal.baseChanged").replace("{blocks}", stale.join(", "));
		return false;
	}
	if (!applyPending()) return false;
	// Re-read: the project got its page id, revision and history entry; the chat marks its latest Build proposal applied.
	const session = getSelectedSession();
	if (!session) return false;
	commitSession({ ...session, updatedAt: nowIso(), proposalBases: undefined, messages: markPendingProposals(session.messages, "applied", "latest", (m) => m.mode !== "ask") });
	return true;
}

export function discardProposal(): void {
	discardPending();
	const session = getSelectedSession();
	if (!session) return;
	commitSession({ ...session, updatedAt: nowIso(), proposalBases: undefined, messages: markPendingProposals(session.messages, "discarded", "latest", (m) => m.mode !== "ask") });
}

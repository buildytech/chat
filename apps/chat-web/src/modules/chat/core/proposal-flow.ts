/**
 * Proposals of the chat: Apply and Discard of the pending candidate (Build; Ask is read-only). The page operations are the project store's
 * (`applyPending`, `discardPending`, `startEmptyProject`); the chat marks its messages.
 */
import { applyPending, discardPending } from "../../../lib/project/store.svelte.ts";
import { commitSession, getSelectedSession } from "./chat.svelte.ts";
import { markPendingProposals } from "./proposals";
import { nowIso } from "./turn";

export function applyProposal(): boolean {
	if (!applyPending()) return false;
	// Re-read: the project got its page id, revision and history entry; the chat marks its latest Build proposal applied.
	const session = getSelectedSession();
	if (!session) return false;
	commitSession({ ...session, updatedAt: nowIso(), messages: markPendingProposals(session.messages, "applied", "latest", (m) => m.mode !== "ask") });
	return true;
}

export function discardProposal(): void {
	discardPending();
	const session = getSelectedSession();
	if (!session) return;
	commitSession({ ...session, updatedAt: nowIso(), messages: markPendingProposals(session.messages, "discarded", "latest", (m) => m.mode !== "ask") });
}

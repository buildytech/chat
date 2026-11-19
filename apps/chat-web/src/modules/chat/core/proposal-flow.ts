/**
 * Proposals of the chat: Apply and Discard of the pending candidate and the Ask
 * proposal that reaches the page only through "Apply in Build". The page operations are the project store's
 * (`applyPending`, `discardPending`, `startEmptyProject`); the chat marks its messages.
 */
import { diffPages, writePage } from "@buildytech/builder-core";
import { t } from "../../../lib/i18n/dictionary";
import { getScreenId } from "../browser/onboarding.svelte.ts";
import { getPageRevision, setCandidatePage } from "../../../lib/page-store";
import { applyPending, discardPending, getSelectedProject } from "../../../lib/project/store.svelte.ts";
import { commitSession, getSelectedSession, setChatMode } from "./chat.svelte.ts";
import { loadPropsGate } from "../../../lib/gates";
import { isPendingProposal, markPendingProposals, withProposalStatus } from "./proposals";
import { blankPage, diffKey, newProposalState, nowIso, provenanceFor, shownPageOf, uid } from "./turn";
import type { ChatMessage } from "./types";

export function applyProposal(): boolean {
	if (!applyPending({ fallbackScreenId: getScreenId() ?? null })) return false;
	// Re-read: the project got its page id, revision and history entry; the chat marks its latest Build proposal applied.
	const session = getSelectedSession();
	if (!session) return false;
	commitSession({ ...session, updatedAt: nowIso(), messages: markPendingProposals(session.messages, "applied", "latest", (m) => m.mode !== "ask") });
	return true;
}

export type AskApplyResult = { ok: true } | { ok: false; code: "outdated" | "not_found" | "rejected"; message: string };

/**
 * "Apply in Build" on the proposal of an Ask answer: the one way an Ask reaches the page. The stored page document goes
 * through the same write gate against the page the author sees now, and applies only when the diff it makes is still the
 * diff the author was shown (the page did not move on). Then the chat is in Build and the page is the next revision:
 * one step, the registry sample props the proposal carries.
 */
export async function applyAskProposal(messageId: string): Promise<AskApplyResult> {
	const session = getSelectedSession();
	const source = session?.messages.find((message) => message.id === messageId);
	const proposal = source?.proposal;
	if (!session || !proposal?.page || proposal.origin !== "ask-proposal" || !isPendingProposal(proposal)) {
		return { ok: false, code: "not_found", message: t("proposal.askNotFound") };
	}
	try {
		await loadPropsGate();
	} catch {
		return { ok: false, code: "rejected", message: t("inspector.loadFailed") };
	}
	const shown = shownPageOf();
	const base = shown ?? blankPage(getSelectedProject());
	const written = writePage(base, { page: proposal.page });
	const stale = (proposal.baseRevision ?? 0) !== (getPageRevision() ?? 0);
	if (!written.ok) return { ok: false, code: "rejected", message: t("proposal.rejected").replace("{code}", written.issues[0]?.code ?? written.code).replace("{message}", `${written.issues[0]?.path ?? "/"}`) };
	const diff = diffPages(base, written.page);
	if (stale || diffKey(diff) !== diffKey(proposal.diff ?? [])) return { ok: false, code: "outdated", message: t("proposal.askOutdated") };
	setChatMode("build");
	const replyText = t("ask.appliedInBuild");
	const request: ChatMessage = { id: uid("msg"), role: "user", text: t("ask.applyProposalRequest"), createdAt: nowIso(), mode: "build" };
	setCandidatePage(written.page, provenanceFor(proposal.screenId ?? null));
	const reply: ChatMessage = {
		id: uid("msg"),
		role: "assistant",
		text: replyText,
		createdAt: nowIso(),
		mode: "build",
		proposal: newProposalState({ page: written.page, diff, warnings: written.warnings, baseRevision: getPageRevision() ?? 0, live: false, screenId: proposal.screenId ?? null, origin: "ask-proposal" })
	};
	const current = getSelectedSession() ?? session;
	const messages = current.messages.map((message) => (message.id === messageId ? { ...message, proposal: withProposalStatus(message.proposal!, "applied") } : message));
	const prior = markPendingProposals(messages, "superseded", "all", (m) => m.mode !== "ask");
	commitSession({ ...current, mode: "build", updatedAt: nowIso(), messages: [...prior, request, reply] });
	return applyProposal() ? { ok: true } : { ok: false, code: "rejected", message: t("proposal.rejected").replace("{code}", "not_applied").replace("{message}", "") };
}

export function discardProposal(): void {
	discardPending();
	const session = getSelectedSession();
	if (!session) return;
	commitSession({ ...session, updatedAt: nowIso(), messages: markPendingProposals(session.messages, "discarded", "latest", (m) => m.mode !== "ask") });
}

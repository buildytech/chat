/**
 * Proposals of the chat: Apply and Discard of the pending candidate, the host-made proposals (no model call) and the Ask
 * proposal that reaches the page only through "Apply in Build". The page operations are the project store's
 * (`applyPending`, `discardPending`, `startEmptyProject`); the chat marks its messages.
 */
import { addScreen, applyOp, diffPages, emptyPage, getScreenById, itemOfSpec, writePage, type DiffEntry } from "@buildytech/builder-core";
import type { PageV2 } from "@buildytech/page-contract";
import { t } from "../../../lib/i18n/dictionary";
import { hydrateSessionContext, getScreenId } from "../browser/onboarding.svelte.ts";
import { getEditBase, getPageRevision, setCandidatePage } from "../../../lib/page-store";
import { applyPending, discardPending, getSelectedProject } from "../../../lib/project/store.svelte.ts";
import { draftPageId } from "../../../lib/project/transitions.ts";
import { commitSession, createSession, getSelectedSession, setChatMode } from "./chat.svelte.ts";
import { loadPropsGate } from "../../../lib/gates";
import { isPendingProposal, markPendingProposals, withProposalStatus } from "./proposals";
import { blankPage, diffKey, newProposalState, nowIso, provenanceFor, shownPageOf, uid } from "./turn";
import type { ChatMessage, ChatProposalState, ChatSession } from "./types";

export function applyProposal(): boolean {
	if (!applyPending({ fallbackScreenId: getScreenId() ?? null })) return false;
	// Re-read: the project got its page id, revision and history entry; the chat marks its latest Build proposal applied.
	const session = getSelectedSession();
	if (!session) return false;
	commitSession({ ...session, updatedAt: nowIso(), messages: markPendingProposals(session.messages, "applied", "latest", (m) => m.mode !== "ask") });
	return true;
}

export type Started = { ok: true } | { ok: false; code: string; message: string };

/** One Build proposal the host made itself (no model call): the candidate, its messages, then Apply. */
export function recordHostProposal(session: ChatSession, requestText: string, replyText: string, page: PageV2, diff: DiffEntry[], opts: { origin?: ChatProposalState["origin"]; screenId?: string | null; baseRevision: number; title?: string }): void {
	setCandidatePage(page, provenanceFor(opts.screenId ?? null));
	const request: ChatMessage = { id: uid("msg"), role: "user", text: requestText, createdAt: nowIso(), mode: "build" };
	const reply: ChatMessage = {
		id: uid("msg"),
		role: "assistant",
		text: replyText,
		createdAt: nowIso(),
		mode: "build",
		proposal: newProposalState({ page, diff, warnings: [], baseRevision: opts.baseRevision, live: false, screenId: opts.screenId ?? null, origin: opts.origin })
	};
	const current = getSelectedSession() ?? session;
	const prior = markPendingProposals(current.messages, "superseded", "all", (m) => m.mode !== "ask");
	commitSession({ ...current, mode: "build", ...(opts.title ? { title: opts.title } : {}), updatedAt: nowIso(), ...(opts.screenId ? { screenId: opts.screenId } : {}), messages: [...prior, request, reply] });
}

/**
 * "Start page from this screen" (Blocks feed): a fresh page from one Stock screen with no model call. The screen's
 * renderable sections become the blocks of an empty page with the registry sample props (addScreen), the write gate
 * checks them and the page is applied at once as the chat's next revision. A chat that already has a page or messages
 * gets a new chat, so nothing is overwritten.
 */
export async function startPageFromScreen(screenId: string): Promise<Started> {
	const screen = getScreenById(screenId);
	if (!screen) return { ok: false, code: "unknown_screen", message: `${screenId} is not a Stock screen.` };
	await loadPropsGate();
	let session = getSelectedSession();
	if (!session || session.messages.length || getEditBase()?.page) session = await createSession();
	const started = addScreen(emptyPage({ title: screen.title, locale: "en", id: draftPageId(getSelectedProject()) }), screen.screenId);
	if (!started.ok) return { ok: false, code: started.code, message: started.message };
	setChatMode("build");
	hydrateSessionContext({ scenarioId: null, screenId: screen.screenId });
	const empty = emptyPage({ title: screen.title, locale: "en", id: draftPageId(getSelectedProject()) });
	recordHostProposal(
		session,
		t("feed.startRequest").replace("{title}", screen.title).replace("{screen}", screen.screenId),
		t("feed.startReply").replace("{title}", screen.title),
		started.page,
		diffPages(empty, started.page),
		{ screenId: screen.screenId, baseRevision: getPageRevision() ?? 0, title: screen.title }
	);
	if (!applyProposal()) return { ok: false, code: "not_applied", message: "The page did not apply." };
	return { ok: true };
}

/**
 * Apply variant from an Ask block card: the chat switches to Build and gets an ordinary set_variant proposal through the
 * same write gate (applyOp -> writePage) as every other edit. Pending until the author presses Apply; no model call.
 */
export function applyVariantFromAsk(spec: string, variant: string): boolean {
	const session = getSelectedSession();
	if (!session) return false;
	setChatMode("build");
	const base = getEditBase();
	const item = itemOfSpec(spec);
	const target = base && item ? base.page.blocks.find((block) => block.item === item) : null;
	const request: ChatMessage = {
		id: uid("msg"),
		role: "user",
		text: t("ask.applyRequest").replace("{variant}", variant).replace("{block}", spec),
		createdAt: nowIso(),
		mode: "build"
	};
	const fail = (key: string): false => {
		const current = getSelectedSession() ?? session;
		const reply: ChatMessage = { id: uid("msg"), role: "assistant", text: t(key).replace("{block}", spec), createdAt: nowIso(), mode: "build" };
		commitSession({ ...current, mode: "build", updatedAt: nowIso(), messages: [...current.messages, request, reply] });
		return false;
	};
	if (!base) return fail("ask.apply.no_page");
	if (!item) return fail("ask.apply.unknown_block");
	if (!target) return fail("ask.apply.block_not_on_page");
	const op = applyOp(base.page, { op: "set_variant", blockId: target.id, variant });
	if (!op.ok) return fail("ask.apply.rejected");
	recordHostProposal(session, request.text, t("ask.applyVia"), op.page, diffPages(base.page, op.page), { origin: "ask-card", screenId: base.provenance?.screenId ?? null, baseRevision: getPageRevision() ?? 0 });
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

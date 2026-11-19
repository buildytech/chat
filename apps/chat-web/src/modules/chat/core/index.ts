/**
 * ChatCore — session/messages logic, no DOM (ADR-0003).
 * Browser persistence is localStorage. Live Grok uses `/runtime`.
 */
export {
	abortInflightRun,
	applyProposal,
	createSession,
	deleteSession,
	deleteAllSessions,
	discardProposal,
	getChatMode,
	setChatMode,
	getRuntimeStatus,
	getSelectedSession,
	applySessionFromUrl,
	hydrateSessions,
	listSessions,
	retryLastFailed,
	selectSession,
	sendMessage
} from "./session.svelte.ts";
export { chatModeOf, turnOutcome, DEFAULT_CHAT_MODE } from "./modes";
export { parseMarkdown, parseInline, type MdBlock, type MdInline } from "./markdown";
export { isPendingProposal, proposalStatus, markPendingProposals } from "./proposals";
export type {
	ChatMessage,
	ChatProposalState,
	ChatRole,
	ChatRunRecord,
	ChatSession,
	CreatorRuntimeStatus,
	ProposalStatus,
	SessionSummary
} from "./types";
export { diffRows, diffText, type DiffRow } from "./change-text";

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
	applyVariantFromAsk,
	getChatMode,
	setChatMode,
	getRuntimeStatus,
	getSelectedSession,
	applySessionFromUrl,
	hydrateSessions,
	listSessions,
	loadPropsGate,
	retryLastFailed,
	selectSession,
	sendMessage
} from "./session.svelte";
export { chatModeOf, turnOutcome, variantProposal, variantTarget, DEFAULT_CHAT_MODE } from "./modes";
export { parseMarkdown, parseInline, type MdBlock, type MdInline } from "./markdown";
export { isPendingProposal, proposalStatus, markPendingProposals, migrateProposal, migrateSessionProposals } from "./proposals";
export type {
	ChatArtifact,
	ChatMessage,
	ChatProposalState,
	ChatRole,
	ChatRunRecord,
	ChatSession,
	CreatorRuntimeStatus,
	ProposalStatus,
	SessionSummary
} from "./types";

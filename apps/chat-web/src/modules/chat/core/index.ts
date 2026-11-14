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
	startPageFromScreen,
	applyAskProposal,
	getChatMode,
	setChatMode,
	getRuntimeStatus,
	getSelectedSession,
	getChatCollection,
	removeCollectionItem,
	openCollectionParam,
	openCollectionFile,
	applySessionFromUrl,
	hydrateSessions,
	listSessions,
	retryLastFailed,
	selectSession,
	sendMessage,
	type AskApplyResult,
	type CollectionIntake
} from "./session.svelte.ts";
export { collectionItemDetail, collectionItemName, collectionNote, type ChatCollection } from "./collection";
export { chatModeOf, turnOutcome, DEFAULT_CHAT_MODE } from "./modes";
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
export { diffRows, diffText, type DiffRow } from "./change-text";

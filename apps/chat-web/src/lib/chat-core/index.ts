/**
 * ChatCore — session/messages logic, no DOM (ADR-0003).
 * Default: local mock (localStorage). Live Grok uses `/runtime`, not Session HTTP.
 */
export {
	abortInflightRun,
	applyProposal,
	createSession,
	deleteSession,
	discardProposal,
	getRuntimeStatus,
	getSelectedSession,
	applySessionFromUrl,
	hydrateSessions,
	listSessions,
	retryLastFailed,
	selectSession,
	sendMessage
} from "./session.svelte";
export type {
	ChatArtifact,
	ChatMessage,
	ChatProposalState,
	ChatRole,
	ChatRunRecord,
	ChatSession,
	CreatorRuntimeStatus,
	SessionSummary
} from "./types";

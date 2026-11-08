/**
 * ChatCore — session/messages logic, no DOM (ADR-0003).
 * Default: local mock (localStorage). Optional Session HTTP with ?live=1.
 */
export {
	createSession,
	deleteSession,
	getRuntimeStatus,
	getSelectedSession,
	applySessionFromUrl,
	hydrateSessions,
	listSessions,
	retryLastFailed,
	selectSession,
	sendMessage
} from "./session.svelte";
export type { ChatArtifact, ChatMessage, ChatRole, ChatSession, SessionSummary } from "./types";

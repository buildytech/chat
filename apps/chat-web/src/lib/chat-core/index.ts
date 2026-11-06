/**
 * ChatCore — session/messages logic, no DOM (ADR-0003).
 * Live path: Session HTTP on context-serve (M4). Mock only with ?mock=1.
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

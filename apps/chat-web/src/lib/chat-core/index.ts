/**
 * ChatCore — session/messages logic, no DOM (ADR-0003).
 * Agent Gateway / AdapterRegistry / cursor-sdk: ADR-0004 (not implemented here).
 */
export {
	createSession,
	deleteSession,
	getSelectedSession,
	hydrateSessions,
	listSessions,
	selectSession,
	sendMessage
} from "./session.svelte";
export type { ChatMessage, ChatRole, ChatSession, SessionSummary } from "./types";

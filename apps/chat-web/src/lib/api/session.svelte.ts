/** @deprecated Import ChatCore from `$lib/chat-core` (ADR-0003). */
export {
	createSession,
	deleteSession,
	getSelectedSession,
	hydrateSessions,
	listSessions,
	selectSession,
	sendMessage
} from "../chat-core/session.svelte";

/** @deprecated Import ChatCore from `$lib/chat-core` (ADR-0003). */
export {
	createSession,
	deleteSession,
	getRuntimeStatus,
	getSelectedSession,
	hydrateSessions,
	listSessions,
	retryLastFailed,
	selectSession,
	sendMessage
} from "../chat-core/session.svelte";

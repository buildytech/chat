import type { ChatSession } from "./types.ts";

/** Only an explicit retry reuses a message. Equal text sent normally is a new utterance. */
export function retryMessage(session: ChatSession, retryOf: string | undefined) {
	if (!retryOf) return null;
	const attempt = session.runAttempts?.[retryOf];
	if (!attempt || attempt.status === "running" || attempt.status === "completed") return null;
	return session.messages.find((message) => message.id === attempt.userMessageId && message.role === "user") ?? null;
}

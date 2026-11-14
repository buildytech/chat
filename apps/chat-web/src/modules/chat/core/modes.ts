/**
 * Ask / Build chat modes (ADR-0011): pure logic, no DOM, no runes. The author picks the mode in the composer; it is
 * stored per chat and never inferred from words. Ask and Build run the same agent turn and end in the same proposal
 * (ADR 0034); Ask's proposal is applied only by the card "Apply in Build", Build's by Apply.
 */
import { isAgentMode, isAgentReply, type AgentMode, type AgentReply } from "@buildytech/chat-agent";
import type { ChatSession } from "./types";

export const DEFAULT_CHAT_MODE: AgentMode = "build";

/** Mode of a chat: its stored choice, else the choice made before the chat existed, else Build. */
export function chatModeOf(session: Pick<ChatSession, "mode"> | null | undefined, pending?: AgentMode | null): AgentMode {
	if (session && isAgentMode(session.mode)) return session.mode;
	return isAgentMode(pending) ? pending : DEFAULT_CHAT_MODE;
}

/** What a finished turn produced: an answer with no proposal, an answer with a proposal, or an error. */
export function turnOutcome(result: { ok: boolean } | AgentReply): "text" | "proposal" | "error" {
	if (!result.ok) return "error";
	return isAgentReply(result) && result.proposal ? "proposal" : "text";
}

/** FNV-1a 64-bit (BigInt-free, two 32-bit lanes). Identity check only, not security. */
export function fnv1a64(text: string): string {
	let h1 = 0x811c9dc5;
	let h2 = 0xcbf29ce4;
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
		h2 = Math.imul(h2 ^ (c + 0x9e), 0x01000193) >>> 0;
	}
	return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/**
 * The prompt-cache routing key of a chat (t85u step 8): stable across its turns, so the static prefix (system prompt and
 * tools) and the turn transcript land on one xAI server; the session id itself is not sent.
 */
export const chatCacheKey = (sessionId: string): string => `chat-${fnv1a64(`buildy-chat:${sessionId}`)}`;

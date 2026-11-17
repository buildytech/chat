/** Bounded dialogue context; the current message is already sent as brief. */
export function conversationForTurn(messages: readonly {id?: string; role: string; text: string}[], currentMessageId?: string) {
 const prior = (currentMessageId ? messages.filter(m => m.id !== currentMessageId) : messages.slice(0, -1)).filter(m => m.role === 'user' || m.role === 'assistant');
 const first = prior.find(m => m.role === 'user');
 const tail = prior.slice(-6);
 const rows = first && !tail.includes(first) ? [first, ...tail] : tail;
 return rows.map(m => ({role: m.role as 'user' | 'assistant', text: m.text.slice(0, 2000)}));
}

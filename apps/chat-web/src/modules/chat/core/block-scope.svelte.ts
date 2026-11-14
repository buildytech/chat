/** Draft context only; keyed by chat, never written into exported page content. */
const picks = $state<Record<string, string[]>>({});
export const blockScope = {
 ids(session: string | null | undefined): string[] { return session ? picks[session] ?? [] : []; },
 toggle(session: string, id: string) { const ids = picks[session] ?? []; picks[session] = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]; },
 clear(session: string) { picks[session] = []; }
};

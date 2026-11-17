/** Draft context only; keyed by chat, never written into exported page content. */
const fieldPicks = $state<Record<string, string | undefined>>({});
const picks = $state<Record<string, string[]>>({});
export const blockScope = {
 fieldId(session: string | null | undefined) { return session ? fieldPicks[session] : undefined; },
 editFields(session: string, id: string) { picks[session] = [id]; fieldPicks[session] = id; },
 ids(session: string | null | undefined): string[] { return session ? picks[session] ?? [] : []; },
 toggle(session: string, id: string) { delete fieldPicks[session]; const ids = picks[session] ?? []; picks[session] = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]; },
 clear(session: string) { delete fieldPicks[session]; picks[session] = []; }
};

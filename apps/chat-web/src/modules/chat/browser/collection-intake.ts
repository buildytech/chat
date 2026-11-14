/**
 * Open in BuildY links (ui8kit/contract docs/collection-intake.md section 2): `/?collection=<base64url>` or the
 * `/build` alias. The payload is read once and removed from the address with history.replaceState before anything
 * else touches the URL, so a reload never imports twice and the payload never lands in a saved session or log.
 */
export const COLLECTION_PARAM = "collection";

/** The `?collection=` payload of `href`, and the same address without it (path, other params and hash kept). */
export function splitCollectionParam(href: string): { payload: string | null; next: string } {
	const url = new URL(href, "http://local/");
	const payload = url.searchParams.get(COLLECTION_PARAM);
	url.searchParams.delete(COLLECTION_PARAM);
	return { payload: payload && payload.trim() ? payload.trim() : null, next: `${url.pathname}${url.search}${url.hash}` };
}

/** Read the payload from the current address once and drop it from the URL (no-op without a window). */
export function takeCollectionParam(): string | null {
	if (typeof window === "undefined" || typeof history === "undefined") return null;
	const { payload, next } = splitCollectionParam(window.location.href);
	if (payload === null && !new URL(window.location.href).searchParams.has(COLLECTION_PARAM)) return null;
	history.replaceState(history.state, "", next);
	return payload;
}

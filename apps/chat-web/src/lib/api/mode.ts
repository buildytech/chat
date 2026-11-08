/**
 * Browser-first transport selection.
 *
 * Default: local mock ChatCore (localStorage + fixture). No Session HTTP, WP, or nonce.
 * Opt-in live Session HTTP: `?live=1` (Vite may proxy `/v1` to optional context-serve).
 * Live mode never silently falls back to mock on API failure.
 */

export function searchParamsOf(search: string = ""): URLSearchParams {
	const raw = search.startsWith("?") || search === "" ? search : `?${search}`;
	return new URLSearchParams(raw);
}

/** True when Session HTTP is explicitly requested. */
export function isLiveSessionMode(search: string = ""): boolean {
	try {
		const raw =
			search || (typeof window !== "undefined" ? window.location.search : "");
		return searchParamsOf(raw).get("live") === "1";
	} catch {
		return false;
	}
}

/** Default Creator path. SSR and missing window stay mock. */
export function isMockMode(search: string = ""): boolean {
	return !isLiveSessionMode(search);
}

/**
 * Session HTTP base for the optional live path.
 * Same-origin `/v1` (Vite proxy when developing). No CMS embed rewrite.
 */
export function apiBase(): string {
	return "";
}

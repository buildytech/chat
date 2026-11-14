/**
 * Browser-first transport. Creator ChatCore is localStorage mock.
 * Protected Grok inference uses `/runtime`, not Session HTTP.
 */

export function searchParamsOf(search: string = ""): URLSearchParams {
	const raw = search.startsWith("?") || search === "" ? search : `?${search}`;
	return new URLSearchParams(raw);
}

/** Session HTTP was removed. Always the mock ChatCore path. */
export function isLiveSessionMode(_search: string = ""): boolean {
	return false;
}

/** Default Creator path. SSR and missing window stay mock. */
export function isMockMode(_search: string = ""): boolean {
	return true;
}

/** Unused Session HTTP base kept so leftover clients compile until deleted. */
export function apiBase(): string {
	return "";
}

/** Session HTTP was removed. Always the mock ChatCore path. */
export function isLiveSessionMode(_search: string = ""): boolean {
	return false;
}

/** Default Creator path. SSR and missing window stay mock. */
export function isMockMode(_search: string = ""): boolean {
	return true;
}


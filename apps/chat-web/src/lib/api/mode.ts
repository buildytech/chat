/** Explicit mock only via ?mock=1. Never fall back to mock on API failure. */
export function isMockMode(): boolean {
	if (typeof window === "undefined") return false;
	try {
		return new URLSearchParams(window.location.search).get("mock") === "1";
	} catch {
		return false;
	}
}

/** Same-origin Session HTTP (Vite proxies /v1 → context-serve). */
export function apiBase(): string {
	return "";
}

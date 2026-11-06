/** Explicit mock only via ?mock=1. Never fall back to mock on API failure. */
export function isMockMode(): boolean {
	if (typeof window === "undefined") return false;
	try {
		return new URLSearchParams(window.location.search).get("mock") === "1";
	} catch {
		return false;
	}
}

type WpCfg = {
	apiBase?: string;
	restBase?: string;
	nonce?: string;
};

function wpCfg(): WpCfg | null {
	if (typeof window === "undefined") return null;
	return (window as unknown as { __BUILDYTECH_SI_CHAT__?: WpCfg }).__BUILDYTECH_SI_CHAT__ ?? null;
}

/**
 * Session HTTP base.
 * - Vite: "" (proxy /v1 → Session)
 * - WordPress: apiBase (.../wp-json/buildytech) so paths `/v1/...` hit plugin REST
 */
export function apiBase(): string {
	const cfg = wpCfg();
	if (cfg?.apiBase) return cfg.apiBase.replace(/\/$/, "");
	if (cfg?.restBase) return cfg.restBase.replace(/\/v1\/?$/, "").replace(/\/$/, "");
	return "";
}

/** WP REST cookie auth nonce when embedded in wp-admin. */
export function wpRestNonce(): string | null {
	const n = wpCfg()?.nonce;
	return n && n.length > 0 ? n : null;
}

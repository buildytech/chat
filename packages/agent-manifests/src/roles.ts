/**
 * Provider per role (ADR 0068): the app picks a provider and a model for each role (Build, Ask, Media) in Settings; the
 * host serves only what it has a key and an allowlist for, and the owner's approved-model lists narrow that further (never
 * widen it). Public data only: the generator copies these values into `contract/runtime-http/constants.json` (`providers`).
 */

/** The providers a host may serve. The web hosts serve xai only; the desktop host serves both. */
export const PROVIDER_IDS = ["xai", "openrouter"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** The roles: Build and Ask turns (chat models) and Media draws (image models). */
export const PROVIDER_ROLES = ["build", "ask", "media"] as const;
export type ProviderRole = (typeof PROVIDER_ROLES)[number];

/** The model kinds of an approved-model list: chat models serve Build and Ask, image models serve Media. */
export const MODEL_KINDS = ["chat", "image"] as const;
export type ModelKind = (typeof MODEL_KINDS)[number];

/** OpenRouter pictures stay off until the owner turns them on (t137u: "for now none"); the hosts refuse them (409). */
export const OPENROUTER_MEDIA_ENABLED = false;

/** The roles each provider can serve on a host that holds its key. */
const ALL_ROLES: readonly ProviderRole[] = Object.freeze(["build", "ask", "media"]);
const TEXT_ROLES: readonly ProviderRole[] = Object.freeze(["build", "ask"]);
export const PROVIDER_ROLE_SUPPORT: Readonly<Record<ProviderId, readonly ProviderRole[]>> = Object.freeze({
	xai: ALL_ROLES,
	openrouter: OPENROUTER_MEDIA_ENABLED ? ALL_ROLES : TEXT_ROLES
});

/** Whether a value names a provider. */
export const isProviderId = (value: unknown): value is ProviderId => PROVIDER_IDS.some((id) => id === value);

/** How long a host reports `state: "limit"` after a provider answered 402 (or 403 naming a key/credit limit). */
export const PROVIDER_LIMIT_TTL_SECONDS = 600;

/** An approved-model list: at most this many ids, each matching the pattern (RE2-compatible). */
export const APPROVED_MAX_IDS = 32;
export const APPROVED_ID_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$";

/** The longest xAI key the desktop accepts from Settings (it never answers it back). */
export const XAI_KEY_MAX = 512;

/** Media draws at most this many picture slots at a time (ADR 0068; t136u burned a key limit drawing all at once). */
export const MEDIA_SLOT_CONCURRENCY = 2;

/** A provider failure that means the key ran out of credit or hit its spending limit. */
export function isProviderLimit(status: number, snippet: string): boolean {
	if (status === 402) return true;
	return status === 403 && /key limit|credit|insufficient|spend(?:ing)? limit|quota|billing/i.test(snippet);
}

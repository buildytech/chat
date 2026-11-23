/**
 * OpenRouter as the desktop app's second provider (ADR 0067): the owner signs in with OpenRouter (OAuth PKCE, the key it
 * mints is the user's own and is billed to the user's OpenRouter credits) and the desktop host forwards the same Grok
 * models through `https://openrouter.ai/api/v1`. The web hosts stay on xAI; nothing here runs on them.
 *
 * Key-free values only: the generator copies them into `contract/runtime-http/constants.json` (`openrouter`), the desktop
 * host reads them from there, and the webview's provider binding reads them from here.
 */

/** The OpenRouter API base (OpenAI-compatible Chat Completions at `/chat/completions`, images at `/images`). */
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** The page the browser opens to sign in (query: callback_url, code_challenge, code_challenge_method=S256). */
export const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";

/** Where the code is exchanged for the user's key (POST {code, code_verifier, code_challenge_method}). */
export const OPENROUTER_KEYS_PATH = "/auth/keys";

/**
 * The loopback callback: `http://localhost:<random port>/cb/<state>`. OpenRouter documents `localhost` callbacks on any
 * port; the state rides in the path because OpenRouter documents no `state` parameter (it appends `?code=` only).
 */
export const OPENROUTER_CALLBACK = { host: "localhost", pathPrefix: "/cb/", ttlSeconds: 600 } as const;

/** The chat models the desktop offers through OpenRouter, the default first (grok-4.20 does not reason unless asked). */
export const OPENROUTER_CHAT_MODELS = ["x-ai/grok-4.20", "x-ai/grok-4.7"] as const;

export const OPENROUTER_CANDIDATE_MODEL: (typeof OPENROUTER_CHAT_MODELS)[number] = "x-ai/grok-4.20";

/** The image model (POST /images, base64 answers stored by the host). */
export const OPENROUTER_IMAGE_MODEL = "x-ai/grok-imagine-image-2.0";

/** Model discovery: chat models, then image models (both public lists, the host still sends its key). */
export const OPENROUTER_DISCOVERY = ["/models", "/images/models"] as const;

/** The header OpenRouter reads for sticky routing (prompt cache); the webview's `x-grok-conv-id` becomes it. */
export const OPENROUTER_SESSION_HEADER = "x-session-id";

/** One USD in the cost unit of the media answer (`costUsdTicks`, xAI's 1e-10 USD ticks); OpenRouter reports USD. */
export const USD_TICKS = 10_000_000_000;

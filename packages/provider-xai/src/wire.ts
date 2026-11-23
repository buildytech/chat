/**
 * The key-free part of the xAI adapter (ADR 0065): the Chat Completions transport and the catalog turn. It reads no
 * environment and holds no key: a caller passes one (the runtime) or HOST_HELD_KEY (the desktop webview, whose host
 * adds its key). The image transport stays server-only in the package root.
 */
export { providerStep } from "./provider.ts";
export { OPENROUTER_FORWARD_BASE } from "./openrouter.ts";
export { HOST_HELD_KEY, runCatalogTurn, turnAnswer, turnInput, type CatalogTurnOptions } from "./turn.ts";

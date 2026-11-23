/** The OpenRouter chat models the desktop app may use (ADR 0067), the default first. */
export const OPENROUTER_CHAT_MODELS = ["x-ai/grok-4.20", "x-ai/grok-4.7"] as const;

/**
 * The openrouter provider definition (ADR 0067), public data: the app keeps its own (xAI) model ids everywhere (selector, scenarios, manifests,
 * replays), and the transport sends the OpenRouter model with its reasoning switch. grok-4.20 does not reason unless
 * asked; grok-4.7 always reasons (its manifest policy, `model_too_slow`, applies through OpenRouter as through xAI).
 */
export const OPENROUTER_MODELS = [
	{ appId: "grok-4.20-0309-non-reasoning", id: "x-ai/grok-4.20", reasoning: { enabled: false } },
	{ appId: "grok-4.20-0309-reasoning", id: "x-ai/grok-4.20", reasoning: { enabled: true } },
	{ appId: "grok-4.7", id: "x-ai/grok-4.7" }
] as const satisfies ReadonlyArray<{ appId: string; id: (typeof OPENROUTER_CHAT_MODELS)[number]; reasoning?: { enabled: boolean } }>;

export type OpenRouterModel = (typeof OPENROUTER_MODELS)[number];

/** The OpenRouter model an app model id is sent as, or null when OpenRouter does not serve it. */
export function openRouterModel(appId: string): OpenRouterModel | null {
	return OPENROUTER_MODELS.find((model) => model.appId === appId) ?? null;
}

/** The app model ids the OpenRouter ids of a status serve (in the definition's order). */
export function appModelIds(openRouterIds: readonly string[]): string[] {
	return OPENROUTER_MODELS.filter((model) => openRouterIds.includes(model.id)).map((model) => model.appId);
}

/** The app model id of the status candidate (`x-ai/grok-4.20` is the non-reasoning default). */
export function appCandidate(openRouterId: string | null | undefined): string | null {
	return OPENROUTER_MODELS.find((model) => model.id === openRouterId)?.appId ?? null;
}


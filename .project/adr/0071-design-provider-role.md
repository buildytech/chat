# ADR 0071: Design as a provider role

Status: accepted (2026-11-28). Owner request t256u, t257u.

Extends [0068](0068-provider-per-role.md) and [0070](0070-design-mode-brand-skins.md).

## Context

Design mode (ADR 0070) sent `POST /runtime/v1/design` with the composer's Build model id and, on the desktop, whatever provider the app was signed in with. The owner's Settings already pick a provider per role (Build, Ask, Media). They asked for a fourth row, Design, defaulting to "Same as Build".

A live Design turn on the desktop, signed in with OpenRouter and using "Grok 4.20 Non-reasoning", failed with the generic copy "The design request could not be completed." (shown twice: the error line and the thread). The app always stores xAI model ids (`grok-4.20-0309-non-reasoning`); the OpenRouter wire needs `x-ai/grok-4.20` and grok-4.20's `reasoning` switch (as the catalog loop already does). The desktop host compared the app id to the OpenRouter list and answered `model_not_listed`. The Design loop dropped that code and message.

## Decision

1. **Design is a fourth provider role.** `constants.providers.roles` is `build`, `ask`, `media`, `design`. xAI serves all four; OpenRouter serves `build`, `ask`, `design` (still no `media` while `openrouter.mediaEnabled` is false). The Settings screen adds a Design row (provider, model, state, spent) when the status lists the role; it defaults to "Same as Build", the same way Ask does. The choice lives in `buildy:v1:providerRoles`. Spend is its own row of `buildy:v1:providerSpend`.
2. **`POST /runtime/v1/design` takes the Design role's provider and model.** The browser sends `provider` (`xai` or `openrouter`) and the app model id. When the row is "Same as Build", it sends Build's. The host uses that provider's key (no silent fallback). Web hosts still serve xAI only: `provider: "openrouter"` is 409 `provider_role_disabled`. An omitted `provider` stays compatible: xAI on the web; on the desktop, OpenRouter when signed in, else xAI.
3. **The host maps app model ids on the OpenRouter wire**, the same mapping as the catalog loop (`openRouterModel`: `grok-4.20-0309-non-reasoning` → `x-ai/grok-4.20` with `reasoning: { enabled: false }`). The completion token parameter is `max_completion_tokens` on both wires. A successful answer may include `costUsdTicks` (xAI `usage.cost_in_usd_ticks`, or OpenRouter `usage.cost` in USD converted); the Settings Design row adds billed ticks only.
4. **The UI shows the host's code and message** when a Design request fails, instead of the generic "The design request could not be completed." The loop no longer swallows the thrown error.

## Consequences

A desktop signed in with OpenRouter can run Design on OpenRouter or on xAI, independently of the sign-in default. Vercel and the node host keep their xAI Design path; the Settings row appears there because the synthesised xAI entry lists the role. The catalog loop is unchanged.

5. **Ask does not apply.** Ask stays read-only. Its system prompt forbids claiming that a page change, theme or Brand Skin was applied, and tells the author to use Build (page) or Design (style). Under an Ask answer that proposes a palette or look, the UI offers **Apply in Design**: it switches the composer to Design and sends that answer as the Design brief; Design validates (fonts in `THEME_FONT_IDS`, radius, WCAG AA) and, if it accepts, writes a Brand Skin. Ask itself writes nothing.
6. **A false "applied" is contradicted in the UI.** Ask never produces a `write_page` proposal and never changes the page revision or `ext.design` skins. If an Ask answer still claims that changes were applied (English or Russian phrasing), the UI shows "Nothing was changed" and, when the text is a style brief, the Apply in Design action. This is a host check of the answer text plus the absence of a proposal, not phrase rewriting of the model.


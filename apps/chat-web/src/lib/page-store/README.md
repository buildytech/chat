# Page Store (chat-web)

One Page DTO feeds Workspace Preview (Svelte UI8Kit blocks) and Code (Svelte UI8Kit source). Applied page and unapplied proposal are stored separately per chat in `buildy:v1:pages` (page-spec store blob). Chat messages stay in `buildy:v1:sessions` (ADR 0015: legacy keys are moved once, both are schema-checked at load, failures go to `buildy:v1:quarantine`). One revision per committed change (`revision.ts`). Hydrate / session switch restore the bound page. Discard does not mutate the saved applied page.

Code is generated from the DTO (`svelteFromPage`) — not a compiler, not Latte, not a second hand-edited source. Domain status `published` is a Page DTO field, not a CMS product.

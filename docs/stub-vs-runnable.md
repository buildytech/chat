# Stub vs runnable

**Runnable (default)**

- `apps/chat-web` — SvelteKit SPA (CreatorShell: AppNav | ChatColumn | Workspace). Mock ChatCore + localStorage. `npm install && npm run dev` / `npm run build`. Preview/Code read the mock Page DTO.

**Runnable (optional, non-default)**

- `apps/xai-runtime` — protected Grok `/runtime`. Server `XAI_API_KEY`. Not Session HTTP.

**Types / docs (no runtime)**

- `packages/page-contract` — Page DTO + `parsePage` (node:test in the package)
- `packages/ports`
- `docs/*`, `design/fig-ref/*`

**Retired placeholders (not product)**

- `services/context-serve` — CI placeholder so the existing Go job stays green until the owner patches the workflow

WordPress plugin/embed is not in this repository (see [ADR-0006](../.project/adr/0006-browser-first-no-wordpress-runtime.md)). Three-host product sequencing (Browser first, then Wails3 same-core, WP import planned elsewhere): [ADR-0007](../.project/adr/0007-one-buildy-three-hosts.md).

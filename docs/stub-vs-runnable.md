# Stub vs runnable

**Runnable (default)**

- `apps/chat-web` — SvelteKit SPA (CreatorShell: AppNav | ChatColumn | Workspace). Mock ChatCore + localStorage. `npm install && npm run dev` / `npm run build`. Preview/Code read the mock Page DTO.

**Runnable (optional, non-default)**

- `services/context-serve` — SQLite PagePort + Session HTTP on loopback. Deterministic stub builder (not a live model). SPA opt-in: `?live=1`. `go test ./...` / `go build`.

**Types / docs (no runtime)**

- `packages/page-contract` — Page DTO + `parsePage` (node:test in the package)
- `packages/ports`
- `docs/*`, `design/fig-ref/*`

**Stubs (not live, not default)**

- `apps/orchestrator` — notes `@grok/agent-sdk@0.6.0`; no keys required
- `services/context-serve` live model / SSE / abort / Context Runtime — not wired
- `adapters/wails3`, `adapters/telegram-mini`
- `deploy/compose` — local CR+SDK compose placeholders

WordPress plugin/embed is not in this repository (see [ADR-0006](../.project/adr/0006-browser-first-no-wordpress-runtime.md)). Three-host product sequencing (Browser first, then Wails3 same-core, WP import planned elsewhere): [ADR-0007](../.project/adr/0007-one-buildy-three-hosts.md).

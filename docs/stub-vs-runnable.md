# Stub vs runnable

Committed in the bootstrap:

**Runnable**

- `apps/chat-web` — SvelteKit SPA (CreatorShell: AppNav | ChatColumn | Workspace). Session HTTP via Vite `/v1` proxy. `npm install && npm run dev` / `npm run build`. Workspace `save_page` UI is not live-model acceptance.
- `services/context-serve` — SQLite PagePort + Session HTTP on loopback. Deterministic stub builder (not a live model). `go test ./...` / `go build`.

**Types / docs (no runtime)**

- `packages/page-contract` — Page DTO + `parsePage` (node:test in the package; not a hosted service)
- `packages/ports`
- `docs/*`, `design/fig-ref/*`

**Stubs (not live)**

- `apps/orchestrator` — notes `@grok/agent-sdk@0.6.0`; no keys required
- `services/context-serve` live model / SSE / abort / Context Runtime — not wired (stub builder is not a live model)
- `adapters/wordpress` — plugin shell + TS client, no REST yet
- `adapters/wails3`, `adapters/telegram-mini`
- `deploy/compose` — local CR+SDK compose placeholders

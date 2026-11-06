# Stub vs runnable

Committed in the bootstrap:

**Runnable**

- `apps/chat-web` — SvelteKit SPA (CreatorShell: AppNav | ChatColumn | Workspace with BlockTree + Preview/Code stubs; mock ChatCore). `npm install && npm run dev` / `npm run build`.
- `services/context-serve` — SQLite PagePort (create/get draft, optimistic revision) on loopback. `go test ./...` / `go build`. CR / Gateway still unwired.

**Types / docs (no runtime)**

- `packages/page-contract` — Page DTO + `parsePage` (node:test in the package; not a hosted service)
- `packages/ports`
- `docs/*`, `design/fig-ref/*`

**Stubs (not live)**

- `apps/orchestrator` — notes `@grok/agent-sdk@0.6.0`; no keys required
- `services/context-serve` CR / sessions / Gateway — not wired (Page Store M2 is live)
- `adapters/wordpress` — plugin shell + TS client, no REST yet
- `adapters/wails3`, `adapters/telegram-mini`
- `deploy/compose` — local CR+SDK compose placeholders

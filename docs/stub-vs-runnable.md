# Stub vs runnable

Committed in the bootstrap:

**Runnable**

- `apps/chat-web` — SvelteKit SPA (CreatorShell: AppNav | ChatColumn | Workspace with BlockTree + Preview/Code stubs; mock ChatCore). `npm install && npm run dev` / `npm run build`.

**Types / docs (no runtime)**

- `packages/page-contract`, `packages/ports`
- `docs/*`, `design/fig-ref/*`

**Stubs (not live)**

- `apps/orchestrator` — notes `@grok/agent-sdk@0.6.0`; no keys required
- `services/context-serve` — go.mod + README (wraps Go CR later)
- `adapters/wordpress` — plugin shell + TS client, no REST yet
- `adapters/wails3`, `adapters/telegram-mini`
- `deploy/compose` — local CR+SDK compose placeholders

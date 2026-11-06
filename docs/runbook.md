# Runbook

## chat-web (runnable)

```sh
cd apps/chat-web
npm install
npm run dev
```

Open the printed localhost URL. Desktop: AppNav | chat | workspace (Preview/Code). Below `lg`: Chat | Page tabs. New chat, type a message, toggle dark/light. Works offline (mock ChatCore).

```sh
npm run build
```

Static SPA with `200.html` fallback for WordPress / Wails / Telegram hosts. CI: `.github/workflows/ci.yml`. Operator notes (ADR / SLO / SLSA): [.project/](../.project/README.md).

## Orchestrator (stub)

Needs `@grok/agent-sdk@0.6.0` and Node 22.13+ when you are ready. Live keys are **not** required to keep this scaffold. See `apps/orchestrator/README.md`.

## context-serve (stub)

```sh
cd services/context-serve
go run .
```

Exits 0 and prints that the CR is not wired. Compose: `deploy/compose/docker-compose.yml`.

## WordPress embed (stub)

Copy the chat-web `build/` next to `adapters/wordpress/buildytech-si-chat.php` when the plugin is filled in. Do not import PHP into `apps/chat-web`.

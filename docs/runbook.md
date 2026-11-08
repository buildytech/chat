# Runbook

## chat-web (default, runnable)

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Desktop: AppNav | chat | workspace (Preview/Code). Below `lg`: Chat | Page tabs. New chat, type a message, toggle dark/light. Works offline (mock ChatCore, localStorage). No WordPress, nonce, `wp-json`, or Session process required.

```sh
npm test
npm run check
npm run build
```

Static SPA with `200.html` fallback. CI: `.github/workflows/ci.yml`. Operator notes: [.project/](../.project/README.md). Browser handoff: [browser-handoff.md](browser-handoff.md). Three-host plan: [plans/one-buildy-three-hosts.md](plans/one-buildy-three-hosts.md).

## Optional Session HTTP (not default)

```sh
cd services/context-serve
go test ./...
go build -o context-serve .
CONTEXT_SERVE_ADDR=127.0.0.1:18090 PAGE_STORE_PATH=data/pages.sqlite ./context-serve
```

Then open the SPA with `?live=1`. Vite proxies `/v1` to that process. API failure does not fall back to mock.

## Orchestrator (optional stub)

Needs `@grok/agent-sdk@0.6.0` and Node 22.13+ when you are ready. Live keys are **not** required to keep this scaffold. See `apps/orchestrator/README.md`. Not part of `npm run dev`.

## Compose (optional)

```sh
docker compose -f deploy/compose/docker-compose.yml up --build
```

Placeholder images for context-serve + orchestrator. chat-web still runs with `npm run dev`.

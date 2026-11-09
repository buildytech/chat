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

## Optional xAI runtime (not default)

```sh
npm run start --workspace=@buildytech/xai-runtime
```

Vite proxies `/runtime` to that process. `services/context-serve` is a retired CI placeholder, not Session HTTP.

## Compose (optional)

```sh
docker compose -f deploy/compose/docker-compose.yml up --build
```

Protected xAI runtime only. chat-web still runs with `npm run dev`.

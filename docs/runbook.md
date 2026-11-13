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

The SPA does not call `/runtime` while it boots. `npm run dev` and `vite preview` work with no runtime process and no network. Live Grok is checked only when you send a message (`GET /v1/status`, then `POST /v1/run` when that status is ready). Start the runtime separately:

```sh
npm run start --workspace=@buildytech/xai-runtime
```

Vite (dev and preview) proxies `/runtime` to that process on `127.0.0.1:18100`. If nothing is listening, the proxy returns JSON 503 `xai_runtime_unreachable` instead of a 500. `services/context-serve` is a retired CI placeholder, not Session HTTP.

## Compose (optional)

```sh
docker compose -f deploy/compose/docker-compose.yml up --build
```

Protected xAI runtime only. chat-web still runs with `npm run dev`.

# Local compose

Stub context-serve plus the protected xAI runtime. Images are not a live Grok product.

```sh
docker compose -f deploy/compose/docker-compose.yml up --build
```

chat-web still runs separately:

```sh
cd apps/chat-web && npm install && npm run dev
```

## Fail-closed publish rules

- `XAI_API_KEY` belongs only on the runtime container/process. Never `VITE_` / `PUBLIC_`.
- Non-loopback runtime bind requires `BUILDY_RUNTIME_BASIC_AUTH_USER` and `BUILDY_RUNTIME_BASIC_AUTH_PASSWORD` or the process exits.
- Browser BYOK in chat-web is UI-only and does not receive the server key.

Protected public staging is Vercel Routing Middleware + `api/runtime`, not this compose file. See `docs/deploy-xai.md`.

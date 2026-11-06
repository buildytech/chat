# Local compose (CR + SDK)

Bring up the **stub** context-serve binary and a Node container for the orchestrator.

```sh
docker compose -f deploy/compose/docker-compose.yml up --build
```

Neither service requires live Agent SDK keys. chat-web runs separately:

```sh
cd apps/chat-web && npm install && npm run dev
```

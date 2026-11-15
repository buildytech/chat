# Runbook

## Run the app

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Works offline: chats and pages live in this browser (`buildy:v1:*`). No runtime process, key or network is needed to browse the catalog and edit pages.

## Checks

```sh
npm test               # every group of scripts/tests.json
npm run test:live      # network tests (UI8KIT_LIVE=1); not part of npm test
npm run check          # tsc --strict, ESLint, ratchets, dead code, ui8px grid, svelte-check
npm run build          # static SPA in apps/chat-web/build (200.html fallback)
npm run verify         # test + inspector coverage + secret scan + audit + check + build + chat-off no-trace and headless smoke
```

Ratchets (`scripts/ratchet-baseline.json`) only go down: `node scripts/check-ratchet.mjs --update`, `node scripts/check-dead.mjs --update`. After a change to a file listed in `inspectorFiles` run `npm run inspector:coverage`; after a runtime change run `npm run bundle:runtime`.

CI: `.github/workflows/ci.yml`. Operator notes: [.project/](../.project/README.md). Three-host plan: [plans/one-buildy-three-hosts.md](plans/one-buildy-three-hosts.md). Refactor plan and audit: [plans/refactor-2026-11.md](plans/refactor-2026-11.md), [plans/audit-2026-11.md](plans/audit-2026-11.md).

## Pinned data

| Command | What |
| --- | --- |
| `npm run snapshot` | Rebuild the Stock plus registry graph (network, about 1 minute); `snapshot:check` is offline; `snapshot:derive` after a policy edit |
| `npm run registry:snapshot` / `registry:check` | The pinned UI8Kit CLI snapshot in `registry/svelte` |
| `npm run schema:check` | The page-spec schema against the validator |
| `npm run icons:aliases` / `icons:aliases:check` | The old Lucide names (smile, home) of the pinned `lucide` package in `lucide-aliases.json` |

## Optional xAI runtime

The SPA does not call `/runtime` while it boots. Live Grok is reached only when you send a message (`GET /v1/status`, then `POST /v1/run` when ready). Start the runtime separately:

```sh
XAI_API_KEY=... npm run start --workspace=@buildytech/xai-runtime
```

Vite (dev and preview) proxies `/runtime` to `127.0.0.1:18100`; if nothing listens, the proxy answers JSON 503 `xai_runtime_unreachable`. Non-loopback access needs Basic Auth. Setup: [xai-grok.md](xai-grok.md), protected Vercel deployment: [deploy-xai.md](deploy-xai.md).

## Compose (optional)

```sh
docker compose -f deploy/compose/docker-compose.yml up --build
```

Protected xAI runtime only; the app itself still runs with `npm run dev`.

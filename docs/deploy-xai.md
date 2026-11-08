# Publish checklist: xAI runtime protection

Do not publish a BuildY host until this list is true. Browser BYOK stays UX/UI only and does not carry `XAI_API_KEY`.

## `XAI_API_KEY` is server-only

| Allowed | Forbidden |
| --- | --- |
| Process environment on `apps/xai-runtime` | `VITE_*`, `PUBLIC_*`, `NEXT_PUBLIC_*` |
| Server `Authorization: Bearer` to `https://api.x.ai/v1` | Keys in the SPA bundle, localStorage, query, or git |
| Parent-box secret / host secret store | Forwarding the key into this Cloud Agent |

`hasPublicSecretLeak` refuses public-prefixed secret names. Status reports `key.present` boolean only, never the value.

## Basic Auth is fail-closed off loopback

`apps/xai-runtime` binds `127.0.0.1:18100` by default.

- Loopback may run without Basic Auth for local constructor work.
- Any non-loopback bind (`BUILDY_RUNTIME_BIND` not `127.0.0.1` / `::1`) **exits at startup** unless both `BUILDY_RUNTIME_BASIC_AUTH_USER` and `BUILDY_RUNTIME_BASIC_AUTH_PASSWORD` are set. Missing credentials are not a warning.
- Shared listeners without a valid `Authorization: Basic` header get `401` and no catalog or model turn.
- Vite `/runtime` proxy is local-dev only. Production must put Basic Auth (or equivalent reverse-proxy auth) in front of the runtime before it is reachable.

Without `XAI_API_KEY`, `GET /v1/status` is `503` and `POST /v1/run` does not call xAI. That path is local catalog assembly and is not a live Grok reply.

## What is not proven

Parent 2026-11-08 proved Chat Completions tool **protocol** on `grok-4.20-0309-non-reasoning` with synthetic TEST tools. That is not Stock catalog assembly. Do not claim live production page builds until a turn uses `search_catalog` / `get_block_details` / `propose_layout` against the pinned snapshot.

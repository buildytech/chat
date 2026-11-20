# xAI Grok chat models

Manual selector first. Same brief, scenario, screen, and catalog snapshot across trials. No automatic multi-model paid benchmark. No autonomous multi-model routing.

## Chat choices (text only)

The built-in selector list (`GROK_CHAT_MODELS`); the runtime narrows it to the ids the key can list (`GET /v1/models`). Image models are not chat choices.

| Label | Exact id | Owner-suggested later role (not routing, not a capability proof) |
| --- | --- | --- |
| Grok 4.20 Non-reasoning | `grok-4.20-0309-non-reasoning` | block selection |
| Grok 4.20 Reasoning | `grok-4.20-0309-reasoning` | block selection |
| Grok 4.20 Multi-agent | `grok-4.20-multi-agent-0309` | task distribution |
| Grok 4.7 | `grok-4.7` | consulting |
| Grok Build 0.1 | `grok-build-0.1` | assembly (kept in the manifest; off in the selector when the key does not list it: `model_not_enabled_on_account`, the box key of 2026-11-20 does not) |

Default selector: `grok-4.20-0309-non-reasoning` (`CANDIDATE_CHAT_MODEL`, used when discovery lists it; otherwise the first listed chat model). Tool calling is reported per turn (`toolCallingProven`), never assumed.

Image models (any id containing `image` or `imagine`) are refused as chat choices (`image_model_not_for_chat`).

If the selected id is missing on the account, the run fails with that id. No silent fallback.

## Usage

Per request/run: actual `prompt` / `completion` / `total` tokens from the provider. Tool loops sum each step's prompt+completion (do not add `total` on top). Reasoning/cache only when the provider sent them. Cancelled or error with no usage object: `UNKNOWN`, not `0`. Session totals include an explicit complete/incomplete status.

Dollar cost is shown only when official current rates for that exact model id are confirmed in-repo, with source and date, marked estimated vs billed. This repo does not pin those rates, so dollars stay unavailable.

Stored with each turn (non-secret): model id, `POLICY_VERSION`, `MODEL_CATALOG_VERSION`, catalog digest. No raw key, request, or error logging.

## Tools

The agent has four application-executed tools: `get_page`, `search_catalog`, `get_block` and `write_page` (ADR 0034). Catalog facets are bounded enums of the pinned Stock snapshot (`catalog/snapshot.config.json`); `hero` is a **job**, not a section. Every write goes through the host gate; the loop stops after two identical error lists.

## Env

- `XAI_API_KEY` — server-only. Never `VITE_` / `PUBLIC_`.
- `XAI_BASE_URL` — optional; the xAI REST endpoint (default `https://api.x.ai/v1`).
- `BUILDY_RUNTIME_BASIC_AUTH_USER` + `BUILDY_RUNTIME_BASIC_AUTH_PASSWORD` — required before a non-loopback bind **and** on Vercel (fail-closed; missing config denies the site).
- Local runtime: `apps/xai-runtime` on `127.0.0.1:18100`. Vite proxies `/runtime`.
- Vercel: root `middleware.js` (Routing Middleware, all paths, ESM `"type": "module"`) + bundled Node Functions `api/runtime/v1/status.ts` and `api/runtime/v1/run.ts` (`maxDuration` 60). Node major is `engines.node` `22.x`. Workspace TypeScript is inlined into those entries. See `docs/deploy-xai.md` and `vercel.json`.

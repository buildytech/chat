# xAI Grok chat models (t16u)

Manual selector first. Same brief, scenario, screen, and catalog snapshot across trials. No automatic multi-model paid benchmark. No autonomous multi-model routing.

## Chat choices (text only)

Parent-verified 2026-11-08. Image models are not chat choices.

| Label | Exact id | Owner-suggested later role (not routing, not a capability proof) |
| --- | --- | --- |
| Grok 4.20 Non-reasoning | `grok-4.20-0309-non-reasoning` | block selection |
| Grok 4.20 Reasoning | `grok-4.20-0309-reasoning` | block selection |
| Grok 4.20 Multi-agent | `grok-4.20-multi-agent-0309` | task distribution |
| Grok 4.7 | `grok-4.7` | consulting |
| Grok Build 0.1 | `grok-build-0.1` | assembly |

Default selector: `grok-4.20-0309-non-reasoning` (parent Chat Completions ping succeeded). Tool calling is still unproven per turn.

Image ids (not in the chat selector): `grok-imagine-image`, `grok-imagine-image-2.0`.

If the selected id is missing on the account, the run fails with that id. No silent fallback.

## Usage

Per request/run: actual `prompt` / `completion` / `total` tokens from the provider. Tool loops sum each step's prompt+completion (do not add `total` on top). Reasoning/cache only when the provider sent them. Cancelled or error with no usage object: `UNKNOWN`, not `0`. Session totals include an explicit complete/incomplete status.

Dollar cost is shown only when official current rates for that exact model id are confirmed in-repo, with source and date, marked estimated vs billed. This repo does not pin those rates, so dollars stay unavailable.

Stored with each turn (non-secret): model id, `POLICY_VERSION`, `MODEL_CATALOG_VERSION`, catalog digest. No raw key, request, or error logging.

## Protocol vs assembly

Parent 2026-11-08: Chat Completions tool-protocol test on `grok-4.20-0309-non-reasoning` returned 2 steps, HTTP 200, tool calls, no retries, usage 393+434=827. That used **synthetic TEST blocks** and artificial `search_blocks(section)` / `propose_page` tools. The model searched `section=hero` while the fixture used `job=hero`, then forced an empty-blocks proposal.

That proves **protocol support**, not page assembly. It is not a production Stock bug. This app’s tools are `search_catalog`, `get_block_details`, `propose_layout`, `get_skill` against the pinned codegen-x snapshot (80 screens, `sha256:a9d256e6935c6a8d579f86d634eebb46dfe36cacd02d9e4e2a0fdce4ff41664a`). Facets are bounded enums. `hero` is a **job**, not a section. No-fit returns clarification and a bounded re-search. Empty unsolicited proposals are rejected unless the author explicitly asks to clear the page.

## Env

- `XAI_API_KEY` — server-only. Never `VITE_` / `PUBLIC_`.
- `BUILDY_RUNTIME_BASIC_AUTH_USER` + `BUILDY_RUNTIME_BASIC_AUTH_PASSWORD` — required before a non-loopback bind **and** on Vercel (fail-closed; missing config denies the site).
- Local runtime: `apps/xai-runtime` on `127.0.0.1:18100`. Vite proxies `/runtime`.
- Vercel: root `middleware.ts` (Routing Middleware, all paths) + `api/runtime/[...path].ts` (Node Function, `maxDuration` 60). See `docs/deploy-xai.md` and `vercel.json`.

Parent verification without this checkout: copy `scripts/verify-xai-parent.mjs`.

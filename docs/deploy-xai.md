# Publish checklist: protected Vercel constructor

Do not create a Vercel project until this list is true. Browser BYOK stays UX/UI only and does not carry `XAI_API_KEY`. Shared keys stay on the parent box / Vercel project env — never in git, never `VITE_` / `PUBLIC_`.

This repo is a **static SvelteKit SPA** (`@sveltejs/adapter-static`) plus a **Node.js Function** for inference. It does not switch to `@sveltejs/adapter-vercel` (that adapter is not in the lockfile). Official Vercel pieces used:

| Piece | Where | Docs |
| --- | --- | --- |
| Other / static output | `vercel.json` `framework: null`, `outputDirectory: apps/chat-web/build` | [Project configuration](https://vercel.com/docs/project-configuration/vercel-json) |
| Routing Middleware | root `middleware.js` (self-contained ESM; root `"type": "module"`). Node runtime, **no matcher** (covers HTML, `/_app`, `/api`, `/runtime`) | [Routing Middleware](https://vercel.com/docs/routing-middleware/getting-started) |
| Node Function (Web `fetch`) | **Concrete** files `api/runtime/v1/status.ts` and `api/runtime/v1/run.ts` (Other / `framework:null` does not route Next.js `[...path]` catch-alls; those 404 as `NOT_FOUND` with no JSON) | [Functions quickstart](https://vercel.com/docs/functions/quickstart), [Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js) |
| SPA fallback | rewrite to `/200.html` after `/runtime/v1/status` and `/runtime/v1/run` → the matching `/api/runtime/v1/*` function | adapter-static `fallback: '200.html'` |

Dashboard Password Protection is a paid plan feature. This app implements fail-closed **HTTP Basic Auth** in Routing Middleware instead. No Fluid Compute / 300s / 800s duration is configured. Function `maxDuration` is **60 seconds** (Hobby-safe documented example). Abort/tool-loop/usage stay in `apps/xai-runtime`; HTTP to the browser remains a JSON body (SDK `streamText` is internal).

## Project env (Vercel dashboard, Production + Preview)

| Name | Required | Notes |
| --- | --- | --- |
| `BUILDY_RUNTIME_BASIC_AUTH_USER` | **yes** | Missing → every path `401`, site is not public |
| `BUILDY_RUNTIME_BASIC_AUTH_PASSWORD` | **yes** | Same. Do not deploy without both |
| `XAI_API_KEY` | for live Grok | Missing → authenticated `/runtime/v1/status` and `POST /runtime/v1/run` return **503** and **do not** call `api.x.ai` |

Never set `VITE_XAI_API_KEY`, `PUBLIC_XAI_API_KEY`, or `NEXT_PUBLIC_*` secrets. `hasPublicSecretLeak` refuses those names.

## Fail-closed rules

- Vercel (`VERCEL=1` / `VERCEL_ENV`) is always a shared public surface. Loopback unauthenticated Node (`127.0.0.1:18100`) is local-only and is not this path.
- Missing Basic Auth user/password **denies** (401 + `WWW-Authenticate`). It does not fall open.
- Wrong credentials deny. Path variants `/`, `/200.html`, `/_app/…`, `/runtime/…`, `/api/runtime/…` all go through Middleware.
- Without `XAI_API_KEY`, no provider call. Local catalog assembly is not a live Grok reply.
- Vite `/runtime` proxy is local-dev only. Staging rewrites `/runtime/v1/status` and `/runtime/v1/run` onto the matching concrete `/api/runtime/v1/*` Functions. A 401 is middleware only; platform HTML `NOT_FOUND` means the Function file is missing.

## Local Node (unchanged)

```sh
npm run start --workspace=@buildytech/xai-runtime   # 127.0.0.1:18100
```

Non-loopback bind still exits unless Basic Auth env is set.

## Staging (parent box)

Do not create the Vercel project from this Cloud Agent. After env is set on the parent:

1. `npm ci && npm test && npm run check && npm run build`
2. `vercel` with root directory = repo root (this `vercel.json`)
3. Confirm unauthenticated `GET /` is 401 before browsing
4. Confirm `POST /runtime/v1/run` without key is 503

Parent still runs `scripts/verify-xai-parent.mjs` with the real key. This checkout never receives `XAI_API_KEY`.

## What is not proven

Parent 2026-11-08 proved Chat Completions tool **protocol** on `grok-4.20-0309-non-reasoning` with synthetic TEST tools. That is not Stock catalog assembly. Do not claim live production page builds until a turn uses `search_catalog` / `get_block_details` / `propose_layout` against the pinned snapshot.

Hobby Function duration is 60s here. The local Node abort ceiling remains 90s. Do not infer a longer Vercel limit.

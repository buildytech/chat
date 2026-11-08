# SI Chat Creator

Browser-first chat builder for ordinary website pages (`page` + unique slug). CMS-agnostic Page Store. Same Creator shell for local mock work: history | Chat | Workspace Preview/Code.

Copyright **BuildYtech**. Licensed under Apache-2.0 (see `LICENSE`).

This repository is **not** a WordPress runtime. WP Builder lives independently in other products. Do not add WP plugin, nonce, or `wp-json` dependencies here.

## Start (mock, no backend)

From the repo root:

```sh
npm install
npm run dev
```

Or:

```sh
cd apps/chat-web
npm install
npm run dev
```

Open the printed `http://127.0.0.1:5173` URL. ChatCore uses **localStorage**. The homepage starts Blank. The chat model selector lists five verified Grok text ids; image models are not chat choices. Optional protected xAI runtime: `XAI_API_KEY` plus `apps/xai-runtime`. Publish only with server-only key and fail-closed Basic Auth (`docs/deploy-xai.md`). No WordPress, no ModulY. See `docs/xai-grok.md`.

```sh
npm test
npm run check
npm run build
```

`npm run build` writes the static SPA (`apps/chat-web/build/`, `200.html` fallback).

## What works now vs planned

| Now (this repo) | Planned (not this cleanup) |
| --- | --- |
| CreatorShell: AppNav / history \| Chat \| Workspace Preview + Code | Browser MVP badges, 12 screens, JSON badges, pagination |
| Mock ChatCore + fake transport | Direct BYOK (memory-only), local-first project persistence |
| Page DTO + Catalog/Page/Publish/Preview ports | Host adapters that implement those ports |
| UI8Kit Svelte primitives, ui8px policy, shadcn tokens | Strict actual-catalog codegen-x shared provider wiring |
| Optional `?live=1` Session HTTP via Vite `/v1` proxy | Paid/live model, deploy, own inference backend |

Owner product spec (Browser future, **not implemented here**): [Creator canvas](https://cursor.com/canvas/store-c3c60695-fe65-4d0c-9e33-7c3f9fe54177/c9e0656b-1cd7-491e-a8e6-07b73acabed9).

Handoff for the next Browser slice: [docs/browser-handoff.md](docs/browser-handoff.md). Architecture: [docs/architecture.md](docs/architecture.md). Runbook: [docs/runbook.md](docs/runbook.md). Agent notes: [AGENTS.md](AGENTS.md).

## Layout

| Path | Role |
| --- | --- |
| `apps/chat-web` | Runnable SvelteKit SPA (default mock) |
| `packages/page-contract` | Framework-neutral Page DTO (`published` is a domain status) |
| `packages/ports` | CatalogPort / PagePort / PublishPort / PreviewPort |
| `apps/orchestrator` | Optional Agent SDK stub (not default) |
| `services/context-serve` | Optional Session HTTP stub (opt-in `?live=1`) |
| `adapters/wails3`, `adapters/telegram-mini` | Host stubs (not WordPress) |

Figma is layout reference only (`design/fig-ref/ARCH.md`).

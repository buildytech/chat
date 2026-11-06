# SI Chat Website Builder

CMS-agnostic chat builder for websites (Lovable-like). Same ordinary pages as the visual Builder: `page` + unique slug.

Copyright **BuildYtech**. Licensed under Apache-2.0 (see `LICENSE`).

## Targets

| Target | Path |
| --- | --- |
| Browser SPA (history sidebar) | `apps/chat-web` |
| WordPress admin (Svelte bundle) | `adapters/wordpress` |
| Wails3 desktop | `adapters/wails3` |
| Telegram Mini App | `adapters/telegram-mini` |

## Run chat-web

```sh
cd apps/chat-web
npm install
npm run dev
```

Then `npm run build` for the static SPA (`200.html` fallback). The mock session API is client-side; no live backend or keys are required.

Architecture: [docs/architecture.md](docs/architecture.md). Runbook: [docs/runbook.md](docs/runbook.md).

## Layout

See the bootstrap brief in `design/fig-ref/ARCH.md`. Figma is layout reference only (sidebar ~248 + content).

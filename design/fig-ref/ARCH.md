# buildytech/chat — bootstrap brief (owner 2026-11-06)

## Product
CMS-agnostic SI Chat Website Builder (Lovable-like).
Targets: browser SPA (history sidebar) · WP admin Svelte bundle · Wails3 · Telegram Mini App.
Same pages as visual Builder (`page` + unique slug). Figma = layout reference only.

## Stack
- Frontend: UI8Kit **Svelte** (`npx ui8kit@3 init --framework svelte`), ru locale, dark/light, **Istok Web embedded**, `rounded-default`, skin like Builder plugin (shadcn HSL tokens).
- Backend: **Go** `context-serve` + **Agent SDK TypeScript** (`@grok/agent-sdk`), local + server.
- Ports: Page / Catalog / Publish / Preview — adapters WordPress, FastyGo later.
- License holder: **BuildYtech** (org owning the repo).

## Figma dump (fig2design, patched g2s null-guard)
9 frames "Chat Preview Site" at 1600 / 768 / 360.
Desktop 1600×1440: Sidebar ~248px + Content ~1352px.
Do **not** copy Inter / kit radii literally — map to UI8Kit tokens + Istok Web + rounded-default.

## Monorepo layout (create on main)
```
apps/chat-web/          # SvelteKit SPA + history sidebar (stub orchestrator ok)
apps/orchestrator/      # Agent SDK bot project
services/context-serve/ # Go CR (or go.mod module stub + README pointing to fastygo-context)
packages/page-contract/ # Page DTO (slug, status, title, layout, seo)
packages/ports/         # CatalogPort, PagePort, PublishPort, PreviewPort
adapters/wordpress/     # thin PHP plugin shell + TS client (embed chat-web build)
adapters/wails3/        # stub README + go.mod placeholder
adapters/telegram-mini/ # stub README
docs/                   # architecture, runbook, fig-ref notes
deploy/compose/         # local CR+SDK compose
design/fig-ref/         # slim frames-summary.json + ARCH (not full 21MB dump)
```

## Hard owner rules
- Commits as `Grok Bot <grokbot@users.noreply.github.com>`
- Push **directly to main**. **Do NOT open a Pull Request.**
- No checkout/payment. No fabricated promo/stock.
- Multilanding/UTM out of P0 (ordinary pages only).

## Done when
1. Monorepo scaffold committed+pushed to main.
2. `apps/chat-web` boots (`npm run dev`) with sidebar + empty thread + composer (UI8Kit Svelte, dark toggle, ru strings).
3. README explains targets + how to run local stack.
4. `docs/architecture.md` documents ports + dual-builder (visual + chat) sharing Page Store.

# Intent

SI Chat Website Builder — turnkey **landing page + embedded chat**, собранный модульно (не клон ChatGPT). CMS-agnostic: обычные страницы (`page` + unique slug) рядом с visual Builder. Один Page Store, разные оболочки.

**Creator:** ChatCore (логика, без DOM) · ChatColumn (thread + composer) · CreatorShell (AppNav + top bar + Workspace). Workspace = BlockTree **текущей** лендинг-страницы. PreviewPort = Svelte admin preview; CodePort = Latte для WP publish; оба из одного Page DTO. Paint = UI8Kit / ui8px + shadcn HSL + Istok + `rounded-default` (структура как spline BuilderScreen, скин spline не копируем).

**Agents:** единственный канал — Agent Gateway (Contract v1). AdapterRegistry: default `context-local` (лёгкий harness / context-serve); opt-in VPS `agent_runtime=cursor-sdk` + env key + local cwd. UI ветвится по **capabilities**, не по имени runtime. `buildytech/vibecode` — spike, не референс.

**P0:** runnable SPA (`apps/chat-web`) с каркасом CreatorShell, контракт портов, адаптеры-заглушки. Нет checkout/payment, нет fabricated promo/stock, нет multilanding/UTM. Нет live `@cursor/sdk` / Docker / WP publish в этом этапе.

**Targets:** browser SPA (Shell+Column+Workspace), WordPress embed (Column ± chrome), Wails3, Telegram Mini App.

Figma — только layout reference. Copyright **BuildYtech**, Apache-2.0.

См. [docs/architecture.md](../docs/architecture.md), [adr/0001](adr/0001-cms-agnostic-chat-builder.md), [adr/0003](adr/0003-creator-surfaces-preview-code.md), [adr/0004](adr/0004-agent-runtime-adapters.md).

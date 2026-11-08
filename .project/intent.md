# Intent

SI Chat Website Builder — turnkey **landing page + embedded chat**, собранный модульно (не клон ChatGPT). CMS-agnostic: обычные страницы (`page` + unique slug) рядом с visual Builder. Один Page Store, разные оболочки.

**Creator:** ChatCore (логика, без DOM) · ChatColumn (thread + composer) · CreatorShell (AppNav + top bar + Workspace). Workspace = BlockTree **текущей** лендинг-страницы. PreviewPort = Svelte admin preview; CodePort = Latte renderer stub; оба из одного Page DTO. Paint = UI8Kit / ui8px + shadcn HSL + Istok + `rounded-default` (структура как spline BuilderScreen, скин spline не копируем).

**Agents:** единственный канал — Agent Gateway (Contract v1). AdapterRegistry: default `context-local` (лёгкий harness / context-serve); opt-in VPS `agent_runtime=cursor-sdk` + env key + local cwd. UI ветвится по **capabilities**, не по имени runtime. `buildytech/vibecode` — spike, не референс.

**P0:** runnable SPA (`apps/chat-web`) с каркасом CreatorShell, контракт портов, mock ChatCore. Нет checkout/payment, нет fabricated promo/stock, нет multilanding/UTM. Нет live `@cursor/sdk` / Docker / CMS publish в этом этапе.

**Targets:** one BuildY product on three hosts (WordPress builder page, Browser, Desktop Wails3) sharing the pinned CodeGen-X Stock catalog ([ADR-0007](adr/0007-one-buildy-three-hosts.md)). This repo ships the **Browser first** (ADR-0006). Wails3 is a later copy of the same core, not a catalog fork (stub today). WordPress remains a separate runtime; portable data import is planned, not implemented here. Telegram Mini App stays an unrelated stub.

Figma — только layout reference. Copyright **BuildYtech**, Apache-2.0.

See [docs/architecture.md](../docs/architecture.md), [docs/plans/one-buildy-three-hosts.md](../docs/plans/one-buildy-three-hosts.md), [adr/0001](adr/0001-cms-agnostic-chat-builder.md), [adr/0003](adr/0003-creator-surfaces-preview-code.md), [adr/0004](adr/0004-agent-runtime-adapters.md), [adr/0006](adr/0006-browser-first-no-wordpress-runtime.md), [adr/0007](adr/0007-one-buildy-three-hosts.md).

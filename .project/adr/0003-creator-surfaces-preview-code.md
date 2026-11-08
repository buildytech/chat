# ADR 0003: Creator surfaces & Preview/Code ports

- Status: Accepted (WordPress embed composition **superseded** by [ADR-0006](0006-browser-first-no-wordpress-runtime.md); CreatorShell / Preview+Code remain)
- Date: 2026-11-06
- Extends: [0001-cms-agnostic-chat-builder.md](0001-cms-agnostic-chat-builder.md)
- Related: [0004-agent-runtime-adapters.md](0004-agent-runtime-adapters.md)

## Context

ADR-0001 зафиксировал CMS-agnostic чат-билдер, один Page Store и четыре host-цели. Не зафиксированы **поверхности UI** (что рисует SPA vs WP embed) и **два рендер-порта** одной страницы: Svelte preview в админке и Latte на публикацию в WordPress.

Продукт — turnkey landing page + встроенный чат, собранный **модульно**. Это не клон ChatGPT и не Lovable-холст с контейнерами.

Структура оболочки как у ui8kit/spline-svelte `BuilderScreen` (nav | chat | workspace с Preview/Code). **Paint** — UI8Kit / ui8px + shadcn HSL tokens, Istok Web, `rounded-default`. Скин spline (круглые primary-кнопки и т.п.) **не** копируем.

## Decision

### Surfaces

| Surface | DOM | Role |
| --- | --- | --- |
| **ChatCore** | no | Session / messages / send. Logic only (`apps/chat-web` mock today: `session.svelte.ts`). Hosts never import DOM from here. |
| **ChatColumn** | yes | Thread + composer. Reusable column for SPA and embeds. |
| **CreatorShell** | yes | AppNav (~248px / `w-62`) + top bar + Workspace. Composes ChatColumn in the SPA host. |

Один `Block` на файл / render path (UI8Kit rule 01). ChatCore не является composition.

### Workspace = Page BlockTree (current page)

Workspace показывает **дерево блоков текущей лендинг-страницы** (какие секции в Page DTO `layout.blocks`). Это не конструктор уровня Lovable (контейнеры, agent shell, произвольный canvas).

Источник правды — тот же Page DTO, что в ADR-0001 (`packages/page-contract`: `page` + unique slug, status, title, layout, seo).

### PreviewPort (Svelte) + CodePort (Latte)

Оба порта **выводятся из одного Page DTO / layout** в Page Store. Паттерн как у существующего WP Builder: runtime Svelte, write Latte.

| Port | Runtime | Where |
| --- | --- | --- |
| **PreviewPort** (Creator render) | Svelte / UI8Kit | Workspace tab Preview — admin preview текущей страницы |
| **CodePort** | Latte | Workspace tab Code — исходник для WP publish |

Это **не** то же самое, что `packages/ports` `PreviewPort.previewUrl()` из ADR-0001 (URL превью у адаптера CMS). URL-порт остаётся. Creator Preview/Code — рендер/экспорт плоскости той же DTO. Имена можно уточнить в коде (`PreviewRenderPort` / `CodeExportPort`) без смены решения.

P0: заглушки из mock Page DTO. Реальный Latte-компилятор и WP publish — вне этой ADR (follow-up).

### Paint vs structure

| Axis | Decision |
| --- | --- |
| Structure | Как spline `BuilderScreen`: AppNav \| ChatColumn \| Workspace (Preview \| Code). Ниже `lg` — вкладки Chat \| Workspace. |
| Paint | UI8Kit Svelte primitives, Istok Web, `rounded-default`, shadcn HSL tokens. Нет spline round-button skin, нет Inter / kit radii из Figma. |

Figma по-прежнему только layout reference (ADR-0001).

### Host composition

| Host | Compose |
| --- | --- |
| Browser SPA (`apps/chat-web`) | CreatorShell + ChatColumn + Workspace (active) |
| WordPress embed | *removed from this repo; see ADR-0006* |
| Wails3 | Same SPA as browser (Shell + Column + Workspace) in the webview. |
| Telegram Mini App | Same SPA; compact Chat \| Workspace tabs acceptable. |

ChatCore общий. Агентский канал — ADR-0004 (Gateway); UI не знает runtime id.

### Non-goals

- Lovable-level canvas: контейнеры, произвольная иерархия, agent shell в workspace.
- Копирование `buildytech/vibecode` Studio / Solid / Docker isolation / multi-tenant TEE. vibecode — spike; паттерны — в ADR-0004.
- Скин spline-svelte (round primary buttons, их paint tokens).
- Живой Latte compiler, WP plugin publish, `@cursor/sdk` wiring — не этот ADR.

## Consequences

- `apps/chat-web` собирается вокруг CreatorShell; mock ChatCore path не ломаем.
- WP embed может подключить только ChatColumn.
- Preview и Code всегда смотрят на одну текущую страницу; расхождение Svelte vs Latte — баг контракта, не «два редактора».
- ADR-0001 (dual builders, Page Store, hosts, ordinary pages only) остаётся в силе.

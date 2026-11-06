# ADR 0001: CMS-agnostic chat builder

- Status: Accepted
- Date: 2026-11-06
- Source of truth: [docs/architecture.md](../../docs/architecture.md)

## Context

Нужен Lovable-like чат для обычных страниц сайта, который **не** привязан к WordPress PHP и делит данные с visual Builder.

## Decision

Два билдера пишут один **Page Store**:

| Builder | Role |
| --- | --- |
| Visual Builder (отдельный продукт) | layout blocks |
| SI Chat (`apps/chat-web`) | chat + history sidebar; тот же Page DTO |

Порты (пакет `packages/ports`): **CatalogPort**, **PagePort**, **PublishPort**, **PreviewPort**. DTO: `packages/page-contract` (`page` + unique slug, status, title, layout, seo).

**Figma** ("Chat Preview Site") — только layout reference (desktop sidebar ~248px; 768/360 → 64px navigate bar). В коде: UI8Kit Svelte primitives, Istok Web, `rounded-default`, shadcn HSL tokens. Не копировать Inter / kit radii / Figma components.

**Targets** (один SPA, разные hosts):

| Target | Path |
| --- | --- |
| Browser SPA | `apps/chat-web` |
| WordPress embed | `adapters/wordpress` |
| Wails3 | `adapters/wails3` |
| Telegram Mini App | `adapters/telegram-mini` |

**Stack split:**

| Piece | Stack | P0 status |
| --- | --- | --- |
| `apps/chat-web` | Svelte 5 / SvelteKit / UI8Kit | runnable |
| `apps/orchestrator` | `@grok/agent-sdk@0.6.0` | stub (no live keys) |
| `services/context-serve` | Go CR wrapper | stub |

P0 pages: ordinary pages only. Нет checkout/payment, fabricated discounts/stock, multilanding/UTM. `apps/chat-web` не импортирует WordPress PHP.

## Consequences

- Адаптеры реализуют порты; chat-web остаётся CMS-agnostic.
- Offline mock (`session.svelte.ts`) закрывает local path, пока orchestrator / context-serve не live.
- Дальнейший FastyGo adapter — тот же Page Store, не форк DTO.

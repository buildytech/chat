# ADR 0001: CMS-agnostic chat builder

- Status: Accepted in part. The WordPress embed host is **superseded** by [ADR-0006](0006-browser-first-no-wordpress-runtime.md); the Page DTO and `layout` are **superseded** by the page-spec 2.0 document ([ADR-0034](0034-page-spec-2-one-write-tool.md)); the Page Store ports stay in `packages/ports`
- Date: 2026-11-06
- Source of truth: [docs/architecture.md](../../docs/architecture.md)

## Context

A Lovable-like chat for ordinary website pages that is **not** tied to WordPress PHP and shares its data with a visual Builder.

## Decision

Two builders write one **Page Store**:

| Builder | Role |
| --- | --- |
| Visual Builder (a separate product) | layout blocks |
| BuildY Chat (`apps/chat-web`) | chat plus history sidebar; the same page |

Ports (`packages/ports`): **CatalogPort**, **PagePort**, **PublishPort**, **PreviewPort**. The page contract lives in `packages/page-contract` (`page` with a unique slug, status, title, seo, blocks).

**Figma** ("Chat Preview Site") is a layout reference only (desktop sidebar about 248px; 768 and 360 use a 64px navigate bar). In code: UI8Kit Svelte primitives, Istok Web, `rounded-default`, shadcn HSL tokens. Do not copy Inter, the kit radii or Figma components.

**Targets** (one SPA, different hosts):

| Target | Path |
| --- | --- |
| Browser SPA | `apps/chat-web` (active) |
| WordPress embed | *removed from this repo; see ADR-0006* |
| Wails3, Telegram Mini App | not in this repo |

P0 pages are ordinary pages only: no checkout, payment, fabricated discounts or stock, multilanding or UTM. `apps/chat-web` imports no WordPress PHP.

## Consequences

- Adapters implement the ports; chat-web stays CMS-agnostic.
- A later FastyGo adapter uses the same Page Store, not a fork of the contract.

## Related / Amend

- [ADR-0003](0003-creator-surfaces-preview-code.md): Creator surfaces, Workspace, Preview and Code.
- [ADR-0004](0004-agent-runtime-adapters.md): the agent channel (superseded by ADR-0011, 0034 and 0041).
- [ADR-0007](0007-one-buildy-three-hosts.md): one product, three hosts, shared Stock; Browser first.

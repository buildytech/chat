# ADR 0006: Browser-first Creator; no WordPress runtime in this repo

- Status: Accepted
- Date: 2026-11-08
- Supersedes in part: [0001](0001-cms-agnostic-chat-builder.md) (WordPress embed host), [0003](0003-creator-surfaces-preview-code.md) (WP embed composition)
- Does not replace: Page Store ports, Page DTO, CreatorShell, SLSA, Agent Gateway

## Context

`buildytech/chat` accumulated a WordPress plugin adapter, wp-admin embed bundle, REST nonce client, and plugin ZIP deploy scripts. WordPress Builder (core + Agent ModulY) already lives independently in other products. This repo needs a clean browser-first Creator start for a new Grok Bot.

## Decision

1. **Active target** is the browser SPA (`apps/chat-web`) with CreatorShell (history | Chat | Workspace Preview/Code).
2. **Default transport** is mock ChatCore (localStorage + fixture). Session HTTP (`services/context-serve`) and the orchestrator remain in-tree as **optional, non-default** (`?live=1`).
3. **Remove** WordPress-specific adapters, embed entry, nonce/`wp-json` client config, plugin packaging, and current-start docs that require WP.
4. **Preserve** framework-neutral Page DTO (including domain status `published`), Catalog/Page/Publish/Preview ports, mock PageStore, Latte CodePort as a renderer, UI8Kit/ui8px/shadcn paint, and core/adapters separation.
5. Historical ADRs stay on disk for provenance. WP-as-host rows are superseded here; do not rewrite git history.

## Consequences

- `npm run dev` must work without WordPress, ModulY, manager, nonce, or `wp-json`.
- A unit guard (`scripts/m4-api-tests/no-wordpress-runtime.test.ts`) fails if WP runtime coupling returns.
- Browser MVP (BYOK, catalog codegen-x shared provider, prompt badges, 12 screens) is **not** this ADR.

## Related

- [docs/browser-handoff.md](../../docs/browser-handoff.md)
- [docs/architecture.md](../../docs/architecture.md)
- [ADR-0007](0007-one-buildy-three-hosts.md) — three-host product; this ADR still bans a WordPress **runtime** in this repo

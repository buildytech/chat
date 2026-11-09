# Browser-first handoff

Cleanup baseline for the next Grok Bot. **Do not treat this cleanup as Browser MVP delivery.**

Owner product spec (informative; implement later):
[https://cursor.com/canvas/store-c3c60695-fe65-4d0c-9e33-7c3f9fe54177/c9e0656b-1cd7-491e-a8e6-07b73acabed9](https://cursor.com/canvas/store-c3c60695-fe65-4d0c-9e33-7c3f9fe54177/c9e0656b-1cd7-491e-a8e6-07b73acabed9)

## Rules for the next agent

- Push to **`main`** only. **No pull requests** (owner absolute rule).
- Commit as `Grok Bot <grokbot@users.noreply.github.com>` via `git -c`.
- No force / reset / amend of published history.
- Do not edit wp-fasty / wpmodules / local-wp. WP Builder core + Agent ModulY live there independently.
- Three-host product (shared Stock, Browser first, Wails3 later): [ADR-0007](../.project/adr/0007-one-buildy-three-hosts.md), [plan](plans/one-buildy-three-hosts.md). Do not start desktop or WP import in this cleanup.

## Shared provider / contract

| Source | Role |
| --- | --- |
| [`github.com/ui8kit/contract`](https://github.com/ui8kit/contract) | Central UI8Kit rules (`AGENTS.md`, `.cursor/rules`, `.cursor/skills`). Copied into this repo. |
| `codegen-x/ui8kit` | Reference implementation / catalog codegen. **Not wired** as the live shared provider here. |
| `@ui8kit` registry (`ui8kit.config.json`) | Intended primitive install; current `apps/chat-web/src/ui` is a vendored Svelte 5 kit. |

## Surviving module map

| Module | Path | Keep |
| --- | --- | --- |
| CreatorShell | `apps/chat-web/src/lib/screens/CreatorShell.svelte` | nav / history \| Chat \| Workspace |
| ChatColumn / ChatCore | `screens/ChatColumn.svelte`, `lib/chat-core` | mock localStorage; Grok via `/runtime` |
| Preview / Code | `screens/PreviewPane.svelte`, `CodePane.svelte` | same Page DTO; Svelte UI8Kit source |
| Page mock store | `apps/chat-web/src/lib/page-store` | fixture, BlockTree, Svelte Code |
| Page DTO | `packages/page-contract` | includes domain status `published` |
| Ports | `packages/ports` | Catalog / Page / Publish / Preview |
| UI8Kit kit | `apps/chat-web/src/ui` | generated primitives; do not hand-patch |
| Optional xAI | `apps/xai-runtime`, `api/runtime` | not Session HTTP |
| Retired Session HTTP | `services/context-serve` | CI placeholder only |

Removed from this repo: `adapters/wordpress`, WP embed entry (`src/embed/wp-main.ts`), `vite.config.wp-embed.ts`, plugin ZIP / WP release pack scripts, `X-WP-Nonce` / `__BUILDYTECH_SI_CHAT__` client config.

## Known missing Browser features (do not claim done)

- Static browser-only local-first (no DB / no own inference backend) as a product, beyond today's mock
- Project persistence in localStorage as a first-class project, not only chat sessions
- Direct BYOK, memory-only key
- UI8Kit **strict actual catalog** via codegen-x shared provider
- True narrow-browser viewport QA (app Preview device frame is not a substitute)
- Formal UI8Kit `ui-gates` / 8+4 / six detectors: not vendored in this repo; app screens are not 8+4. Do not claim full strict compliance.
- Generated `Button` has `aria-pressed?: string` only (no `pressed` boolean). No `Switch` / `checked` primitive. Night Mode keeps `role="switch"` + `aria-checked` as a workaround. Do not hand-edit kit files.
- Generated `Separator` sets redundant `role="separator"` on `<hr>`; fix through generator/spec only.
- Owner-only: apply [`docs/owner-workflow-cleanup.patch`](owner-workflow-cleanup.patch) to drop `.github/workflows/ci.yml` job `context-serve`

## Next implementation scope

When owner authorizes Browser MVP: keep CreatorShell and ports; add the missing Browser surfaces above. Do not reintroduce a WordPress runtime. Do not rewrite Page schemas to fake Stock compatibility. No deploy, proxy-as-product, paid smoke, credentials, or telemetry logging.

Regression: `scripts/m4-api-tests/no-wordpress-runtime.test.ts` (part of `npm test`).

# ADR 0009: Brands live in CodeGen-X; the published registry stays one

- Status: Accepted
- Date: 2026-11-10
- Extends: [0007](0007-one-buildy-three-hosts.md) (one pinned Stock catalog), [0008](0008-registry-single-source-of-ui.md) (the UI8Kit registry is the single source of UI)
- Does not replace: 0006 (no WordPress runtime in this repository), 0008 (CLI snapshot, variants pin, lock, check)
- Owner: approved 2026-11-10 (record this in the plan)
- Plan: [docs/plans/one-buildy-three-hosts.md](../../docs/plans/one-buildy-three-hosts.md)

## Context

It is tempting to give each brand (for example Preline, Flowrise, Material, Ant Design, Bootstrap 5, UIKit3, or a new author such as AiVEO tech) its own full kit: rules, contract, CLI, and registry, or its own namespace and URL on `registry.buildy.tw`. That would fork the supply chain and force the CLI, the chat, and WP FastY Builder to hard-code authors.

The product goal is the opposite: one UI8Kit set, many brands. A brand changes tokens and presets (radius, colour tokens, shadows, density, fonts, palettes, blocks) under the same UI8Kit rules. Open contribution to a brand kit would also turn into spam under AI-assisted pull requests; large libraries now accept PRs only from trusted people.

A 2026-11-10 check showed that a Latte snapshot from the same CLI path the chat already uses is already viable for templates (details below). What WordPress still needs beyond templates (catalog data, previews, starters, theme CSS) is not designed in this ADR; the owner will discuss WordPress further.

## Decision

1. **No per-brand kits.** Do not ship a separate rules, contract, CLI, or registry per brand. Do not add author namespaces or author URLs. The CLI stays a single-registry client of `@ui8kit`.
2. **A brand is a CodeGen-X record.** A brand (for example AiVEO tech) is a row in the CodeGen-X database: a badge and a brand filter. New brands start there, not as a new published registry.
3. **Contribution is closed and trusted.** Do not accept free pull requests into the kit, so brand systems do not turn into AI spam. Brands contribute under UI8Kit rules: presets, fonts that are not yet present, palettes, and blocks. They land through XGenBot and the generator in `codegen-x/ui8kit`.
4. **One cleaned registry.** `registry.buildy.tw` receives brand output already cleaned and unified into the single `@ui8kit` registry. The brand is visible as metadata (for example `meta.brand` on items and in variants) so Stock and the chat can filter by brand.
5. **One snapshot path for chat and WordPress.** BuildY chat and WP FastY Builder both consume that registry with `npx ui8kit init` / `add --all` snapshots: sha256 lock, pinned `variants`, and `check`. They do not keep a private export of the same items.

## Verified (2026-11-10)

- Latte CLI snapshot: 341 of 341 items; `ui8kit check` confirmed 370 files.
- 240 of 240 shared block files were byte-identical to the current plugin bundle.
- Plugin primitives lag the snapshot (registry 3.3.0 / CLI 3.2.1).

## Open follow-ups (not designed here)

WordPress will be discussed further with the owner. No new XGenBot or WPDesigner issues are opened with this ADR.

- Catalog data for WordPress (prop types, WordPress bindings, record types, collections) published next to `variants`. Design is pending.
- WP FastY Builder snapshot via the CLI, so the plugin no longer lags primitives and can pick up new blocks from the same pin the chat uses.
- The brand metadata field on items and in variants.

Previews, starters, and theme CSS may remain plugin artifacts until that discussion lands. This ADR does not invent a catalog format or a second registry URL.

## Consequences

- Chat and WP FastY Builder stay on the same published registry; updating either is a new snapshot plus `check`, not a hand edit or a private export.
- Brand work (tokens, presets, fonts, palettes, blocks, later skins) is done in CodeGen-X and reaches products only after the generator has unified it.
- Filters in Stock and in the chat use `meta.brand` (or the equivalent field in variants), not a hard-coded list of authors or URLs.
- 0008 still governs the chat snapshot (`registry/svelte`, variants pin, `lib` without components, ZIP = CLI). 0006 still bans a WordPress runtime in this repository.

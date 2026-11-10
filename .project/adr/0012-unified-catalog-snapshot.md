# ADR 0012: Unified catalog snapshot (codegen-x Stock + UI8Kit registry)

- Status: Accepted
- Date: 2026-11-10
- Extends: [0007](0007-one-buildy-three-hosts.md) (one pinned Stock for three hosts), [0008](0008-registry-single-source-of-ui.md) (registry snapshot), [0010](0010-props-schemas-program-gate.md) (props schemas)
- Owner: approved 2026-11-10 (one snapshot pipeline with full facet and relation coverage; enrichment happens in the sources)

## Context

The chat read the catalog from three places with three scripts:

- `packages/builder-core/src/catalog/snapshot.json` (80 screens, 112 block specs) had no generator in the repo;
  `rendererMap` and `ownerFilters` were edited by hand inside it.
- `scripts/build-catalog-index.mjs` fetched `assets.v0.json` and `facets.v0.json` at codegen-x `6b2e71b` and wrote
  `search-index.json`, and rewrote `blockIndex` of `snapshot.json` in place.
- `scripts/registry-snapshot.mjs` pinned the real `npx ui8kit init` + `add --all` tree, `variants/v0.json` and
  `props/v0.json`.

What the runtime kept was a fraction of what the sources publish. Dropped: 12 of 17 facets on screens (role,
composition, character, density, pattern, media, markup, ...) and every facet on blocks/variants; the ordered screen
composition of `previews.v0.json` (chrome before / area blocks / chrome after, with the variant and props of each
row) - the chat only had the unordered `labels.blocks`; the per-screen install list (`install.v0.json`); block
samples, defaults and data bindings (90 collections); pattern terms with definitions; quick filters and sorts;
registry item metadata (kind, category, group, runtimes) and the item dependency graph; record types of the props
contract. Stock and the registry also live at one commit now: `registry.json.sourceCommit` is the codegen-x commit
the registry was built from, and Stock publishes the same `variants.v0.json` / `props.v0.json` byte for byte.

## Decision

1. **One command, one config.** `npm run snapshot` reads `catalog/snapshot.config.json` (the codegen-x repo and
   commit, the Stock files; the ui8kit CLI version, registry URL, runtime and registry files). It runs the real CLI
   (`scripts/registry-snapshot.mjs`, unchanged output: `registry/svelte` stays 1:1 with `npx ui8kit add`), fetches
   every input, sha256s each one and fails when the sources disagree: `registry.json.sourceCommit` must be the pinned
   commit, Stock and registry `variants` / `props` must be the same bytes as the files pinned in `registry/`, and the
   live `svelte/index.json` must be the one the CLI step pinned. About one minute; `--skip-cli` skips the CLI step.
2. **One graph.** `catalog/stock-registry.v0.json` (format `buildy-stock-registry`, version 0) holds typed entities
   and explicit edges. Entity maps are keyed by source ids (Stock ids for screens, blocks and variants, registry
   names for items and props):

   | Entity | Source |
   | --- | --- |
   | `locale` | Stock `i18n/locales.json` |
   | `facet`, `facetValue` (`<facet>/<value>`) | `facets.v0.json` (all 17 facets, hidden ones marked), values resolved by Stock for `valuesFrom` facets, pattern terms with definitions |
   | `screenFamily` | `previews.v0.json` screens (areas) |
   | `screen` | screen assets (title, spec, order, added, preview, weak / missing facets, search fields) |
   | `block` | Stock block specs (title, organism, defaults, sample, alt, fit, pattern draft) |
   | `variant` | block assets (one per variant, with set, sample, weak / missing, fields) |
   | `item` | registry runtime index + `registry.json` (type, kind, category, group, runtimes, files, axes, defaults) |
   | `props` | `props/v0.json` (organism, property names, required, events, slots, pointer to the schema) |
   | `record` | shared object `$defs` of the props contract |
   | `icon` | the published `lucideIcon` enum |
   | `collection` | data bindings of block previews (collection name, field paths) |

   | Edge | Meaning |
   | --- | --- |
   | `facet-has-value` | facet vocabulary, ordered |
   | `screen-in-family` | screen is an area of a family |
   | `screen-contains-block` | ordered composition: `order`, `region` (before / area / after), `variant`, row props |
   | `screen-installs-item` | ordered `npx ui8kit add` list of the screen |
   | `screen-tagged-facet`, `variant-tagged-facet` | facet labels (`weak: true` when Stock marks them draft) |
   | `block-has-variant` | ordered variants of a block |
   | `block-implemented-by-item`, `variant-implemented-by-item` | registry item of a block / variant (`default` variant marked) |
   | `variant-sets-props` | preset props of a variant |
   | `item-depends-on-item` | `registryDependencies` |
   | `item-has-props`, `props-uses-record` | props schema of an item, records it uses |
   | `block-binds-collection` | data a block reads (`as`, field mapping) |

   The block -> registry item mapping is data: the `registry` field of each Stock block asset and the `asset` of
   each `variants.v0.json` variant (the test checks they agree). The graph keeps no BuildY policy and no derived
   ranking; full JSON Schemas stay in the pinned `registry/props.v0.json` (the `props` entity points into it).
3. **Validation is part of the pipeline.** Every edge resolves to an existing entity of its declared type; every
   composition row names an existing variant; every variant preset validates against its props schema with Ajv 2020
   strict, without `required` lists (a preset merges over content, as in Stock's props test); counts are exact;
   output is canonical (stable key order, one entity / edge per line, ASCII only).
4. **Coverage is computed.** `catalog/coverage.json` lists, from the graph and the policy: Stock blocks / variants
   without a registry item, registry blocks without a Stock block, props without variants, facets and facet values
   no asset carries, screens whose block labels differ from their composition, missing and weak facet labels,
   collections without data, Stock blocks without a Page DTO kind and the screens they affect. It is a report, never
   an input.
5. **BuildY policy is one declared file.** `catalog/policy.v0.json` is the only hand-written catalog data: page size,
   owner filters (blank / dashboard / landing / website), the searchable facets, the Page DTO kinds and the Stock
   block -> Page DTO kind map (formerly `rendererMap`, hand-edited inside `snapshot.json`). The pipeline fails when
   a policy entry names a block, facet value or kind that does not exist.
6. **Runtime artifacts are derived.** `snapshot.json` and `search-index.json` are generated from the graph + policy
   with the same shape as before; `sources.json` and `props.json` keep coming from `registry/` (ADR 0008 / 0010).
   `scripts/build-catalog-index.mjs` is removed; `npm run catalog:index` is an alias of `npm run snapshot:derive`.
7. **Lock and checks.** `catalog/snapshot.lock.json` records the config and policy sha256, the codegen-x commit and
   sha256 + size of every Stock input, the CLI version, registry `sourceCommit` and sha256 of every registry input,
   the pinned `registry/` files, and the sha256 of every output. `npm run snapshot:check` is offline: every pinned
   and generated file matches the lock, the graph validates and is canonical, every derived artifact regenerates byte
   for byte, and `registry-snapshot --check` passes. Stock files, `registry.json`, `manifest.json` and the index are not vendored (only their sha256; `variants` and `props` stay pinned in `registry/`), so the graph is
   the offline source of truth; a network run at the same pins reproduces it byte for byte.
8. **Enrichment happens in the sources.** Better titles, labels, synonyms, relations and new entities are added in
   codegen-x Stock (XGenBot) or in the registry generator, then the pin in `snapshot.config.json` moves and
   `npm run snapshot` runs again. The chat never patches catalog data; `coverage.json` says where to enrich first.
9. **Locale data.** Facet and value labels come in en, fr, de, es and ru from Stock. They are data, stored as `\u`
   escapes, so no repository file carries Cyrillic text outside the ru locale files.

## Consequences

- One pin moves the whole catalog: codegen-x `6b2e71b` -> `3a6d923` (the registry's `sourceCommit`; Stock assets and
  facets are byte-identical between the two). `snapshot.json` and `search-index.json` differ from the previous
  files only in `pinnedCommit`; the catalog digest used by the proposal gate (`sourceDigest`) is unchanged, so
  search ranking and saved pages are unaffected.
- The Lab (Wails) and the WordPress builder can read `stock-registry.v0.json` as is. The future query constructor
  of Build mode (quiz / drill-down chains declared as schema + panel) walks these entities and edges: facet values
  narrow screens and variants, `screen-contains-block` and `block-has-variant` open the next branch,
  `variant-sets-props` + `props` give the fields. Nothing in this ADR builds that UI.
- The graph is about 1.8 MB and is not bundled into the browser; the browser keeps loading the derived files.
- Open: collections have no data in Stock content (`collectionsWithData` 0), `ui.*` dictionary texts referenced by
  samples are not published in Stock content, and 87 of 112 Stock blocks have no Page DTO kind (BuildY policy, see
  coverage).

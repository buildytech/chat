# Remove page-family (advisory PAGE_FAMILIES)

Status: planned  
Supersedes (once done): the remaining feed-hint slice of [ADR 0027](../adr/0027-advisory-screen-family.md) that [ADR 0034](../adr/0034-page-spec-2-one-write-tool.md) kept as “advisory family ranks the Blocks feed”.  
Source: `packages/builder-core/src/catalog/page-family.ts`

## Why

After page-spec 2.0 the screen family is not a write rule, is not stored on the page document, is not sent to Ask/Build, and no longer has a pin / undo / Sections picker in the chat UI. What remains is:

- derive a `PageFamily` from the page’s blocks;
- map it to kinds via `familyKinds`;
- pass those kinds as `boostRoles` into `stockSearch` so the Blocks feed ranks “family” kinds first.

That reorder is the only live product effect. Hard rules stay: renderer exists, page-spec schema, props gate (header / footer have no position or count rule, ADR 0037). Dropping the module removes dead ADR 0027 surface without changing write / export / preview correctness.

## Decision (when executed)

Delete the advisory page-family layer entirely. The Blocks feed uses plain `stockSearch` (query + facets + paging) with no `boostRoles` from a derived family. Do **not** remove Stock “screen family” helpers used for sample provenance (`FAMILY_HOME_SCREENS`, `kindSourceFor`, `screenFamily` in provenance / catalog-graph) — those are a different concept.

## Delete

### Core

| Path | What |
| --- | --- |
| `packages/builder-core/src/catalog/page-family.ts` | Whole module: `PAGE_FAMILIES`, `NAMED_FAMILIES`, `PageFamily`, `isPageFamily`, `familyScreenId`, `familyOfScreen`, `familiesOfKind`, `deriveFamily`, `familyKinds` |
| `packages/builder-core/src/index.ts` | Re-exports of the symbols above |

### Chat web (call sites)

| Path | What |
| --- | --- |
| `apps/chat-web/src/lib/feed/feed.svelte.ts` | Drop `deriveFamily` / `familyKinds` imports; call `stockSearch({ q, ...filters, page, pageSize })` without `boostRoles` |
| `apps/chat-web/src/lib/inspector/inspector.svelte.ts` | Drop `get family()`, `deriveFamily` / `PageFamily` imports |
| `apps/chat-web/src/app/ChatColumn.svelte` | Remove the dead `inspector.familyNote` status label and ADR 0027 comment (the getter was never implemented; toast never fires) |

### Optional follow-up on `stockSearch`

| Path | What |
| --- | --- |
| `packages/builder-core/src/catalog/stock-search.ts` | If nothing else passes `boostRoles`, remove the option and the boost reorder branch; otherwise leave the optional param (harmless when unused) |

### Tests

| Path | What |
| --- | --- |
| `scripts/m4-api-tests/screen-family.test.ts` | Delete the file (orphan: not listed in `scripts/tests.json`; still asserts pinFamily / set_family / old `deriveFamily({ kind })` shapes) |
| `scripts/m4-api-tests/page-ops.test.ts` | Drop `deriveFamily` import and the assert that only checks it returns a string |
| `scripts/m4-api-tests/blocks-feed.test.ts` | Drop the source match that requires `boostRoles` in `feed.svelte.ts` |

### Docs / product copy (same change)

| Path | What |
| --- | --- |
| `AGENTS.md` | Screen-family bullet: either remove the “feed hint” claim or point at this note / a superseding ADR |
| `.project/adr/0027-advisory-screen-family.md` | Amend or supersede: feed ranking and pin/undo UI are gone; keep the historical decision that family must never refuse a block |
| `.project/adr/0034-page-spec-2-one-write-tool.md` | Drop “advisory family as a feed hint” from the Kept list when the code is gone |
| `.project/adr/README.md` | Align the 0027 / 0034 blurbs with the amendment |

### Schema leftovers (optional, separate pass)

These are page-spec 1.x / session history fields; v2 pages do not store family. Cleaning them is contract work, not required to stop the feed boost:

| Path | What |
| --- | --- |
| `packages/page-contract/schema/page-spec.schema.json` | `provenance.family`, `provenance.familyPinned` (1.4.0 advisory fields) |
| `packages/page-contract/schema/session.schema.json` | revision op `set_family` |
| `packages/page-contract/src/session.ts` | `SessionRevisionOp` member `"set_family"` |

Prefer leaving schema enums additive until an explicit contract bump; do not break load of old sessions for a dead op name.

### Generated bundles

After the source delete, rebuild whatever inlines builder-core (`api/runtime/v1/run.ts`, `status.ts`, etc.) so the vendored copy of `page-family.ts` disappears. Do not hand-edit those blobs.

## Keep (do not delete with this refactor)

| Symbol / area | Why |
| --- | --- |
| `FAMILY_HOME_SCREENS` in `packages/builder-core/src/catalog/provenance.ts` | Empty-page / kind-source home screens (landing, food-grill, restaurant, dashboard Stock homes) |
| `screenFamily()`, `familyLabelForKind()`, `kindSourceFor()` in provenance | Sibling Stock screens + sample source when the page’s recorded screen has no section of that kind |
| `EMPTY_PAGE_SCREENS` in `packages/builder-core/src/inspector.ts` | Alias of `FAMILY_HOME_SCREENS` for starting an empty page |
| Catalog-graph entity `screenFamily` / edge `screen-in-family` (`scripts/lib/catalog-graph.mjs`) | Stock catalog graph, not `PAGE_FAMILIES` |
| i18n `feed.why.not_in_screen_family`, `feed.spec` (“Block or screen family”) | Refer to Stock screen family / facets, not the advisory enum |
| Hard rules that family must never refuse a registry block with a renderer | Product rule from ADR 0027; remains true without the module |

## Steps (suggested order)

1. Remove feed boost and inspector/ChatColumn call sites first so the package export is unused.
2. Delete `page-family.ts` and its `index.ts` exports.
3. Delete / trim the three test touchpoints; ensure `scripts/tests.json` still lists every remaining file under `m4-api-tests` exactly once.
4. If `boostRoles` has no remaining callers, remove it from `stockSearch`.
5. Update AGENTS + ADR blurbs (or open a short superseding ADR).
6. Rebuild runtime bundles that embed builder-core.
7. Run `npm test` (at least groups `builder-core` and `chat-web`) and `npm run check`.

## Verify

- `npm test` green; no references to `deriveFamily`, `familyKinds`, `PAGE_FAMILIES`, `PageFamily`, `pinFamily`, `familyNote` in `apps/` or `packages/builder-core/src` (except historical ADR text if left).
- Blocks feed still returns the same total / facets; only item order on a non-empty page may change vs before.
- Adding a block of any kind on a mixed page still succeeds (no family refuse path to regress).
- ZIP export and render probe unchanged.
- Dead-code / unused-export ratchets do not rise; lower them if the delete frees exports.

## Out of scope

- Redesigning Stock search ranking (facets, text score).
- Changing how `kindSourceFor` walks home screens for samples.
- Migrating or stripping `provenance.family` from quarantined 1.x page records (ADR 0045 already refuses old pages).

# ADR 0019: Stock collection intake (Open in BuildY)

Status: accepted (2026-11-11). Build mode only. Extends ADR 0015 (session standard) and ADR 0018 (self-correction).
Spec: ui8kit/contract `docs/collection-intake.md`; schema `https://schema.buildy.tw/collection.schema.json`
(`buildy-collection:v1`); session 1.3.0 `collection`. Issue: alexy-os/chaosbun#151.

## Context

A person gathers Stock screens and block variants on Stock (https://app.codegen-x.com/, Collections) and presses
**Open in BuildY**. The chat must build from those blocks only. Hybrid model: the chat searches only its own frozen
catalog snapshot; items the snapshot lacks are skipped and named, never replaced by look-alikes.

## Decision

1. Entry: `/?collection=<base64url JSON>` and the `/build` alias (same page). `takeCollectionParam`
   (`lib/browser/collection-intake.ts`) reads the payload once at start and removes it with `history.replaceState`
   before the session query is synced. A downloaded `<title>.buildy-collection.json` goes through Settings > Import
   or `buildy.import(json)`: the reader is picked by `format`.
2. Checks (`@buildytech/page-contract/collection`): at most 65 536 decoded bytes, UTF-8, `JSON.parse`, the vendored
   `collection.schema.json` (dependency-free validator), program checks `duplicate_item`, `empty_collection`. Any
   failure imports nothing and shows one error with the code and the first path.
3. Split (`splitCollection`, builder-core): screen items need the snapshot screen, block items the variant entity
   (`block.<name>/<variant>`) or the block. Missing items are dropped and named in one note under the chips
   (plus "another Stock version" when `pins.stock.assetsDigest` differs from the snapshot digest).
4. A new Build chat: titled with the collection, its `skin`, its first present screen as the chat screen, the present
   items as removable chips above the composer. The chat stores `collection` (session 1.3.0: `id`, `title`,
   `importedAt`, `assetsDigest`, `items`, `missing`).
5. Every Build turn sends `collection: { id, title, items }`. The runtime recomputes the bounds from its own snapshot
   (`collectionBounds`; never trusts a client list): allowed = block items plus the blocks of screen items
   (screen-contains-block); required = block items with their variants. The model reads them in the user payload
   (`collection`: required, allowedCatalogBlocks, screens, notes as hints) and one system line.
6. `propose_layout` checks the assembled page (`checkCollectionPage`): a top-level block whose catalog block is
   outside the set is `outside_collection`; a required item a free block of its kind could carry is
   `collection_item_unused`. Both come back at path `collection` with `fix` (allowed list, outside blocks, unused
   items). Required items without a page renderer or without a free block of their kind are said in warnings.
7. Repair (ADR 0018 loop): a second collection rejection, or a budget spent on one, is repaired by the host:
   unused items are added as `blocks[]` entries (`repairCollectionArgs`), then the page is assembled with the prune
   bound (`pruneToCollection`): blocks outside the set are left out, each named in warnings. Nothing is substituted.
   The local assembler (no model) places the required items and prunes at once.

## Consequences

- The page holds only collection blocks; what could not be placed is said, not hidden.
- Many catalog blocks have no page renderer yet (`rendererKind` null): such items show as chips, reach the model,
  and are reported as not placed.
- Online refinement (REST / MCP, alexy-os/chaosbun#148) is out of scope.

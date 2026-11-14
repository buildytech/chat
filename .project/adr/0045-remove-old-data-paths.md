# ADR 0045: The old-data paths are removed; old data is refused and set aside, never converted

Status: accepted, 2026-11-14. Owner decision (t190u): only the owner used old sessions and his `migrationReport()` was all zeros, so item 4 of the refactor plan goes ahead. Follows ADR 0034, 0040, 0044.

## Removal criterion (recorded)

The counters of the previous round (`pageV1`, `feedScreen`, `legacyKeys`, `proposalApplied`) were read by the owner, the only user with data from before page-spec/v2 on staging: all zero since they shipped. The owner confirmed the removal on 2026-11-14.

## Decision

Removed: `migratePageV1` and `page-doc/migrate.ts`; `catalog/props-overrides.ts` and the page-spec/v1 content mapper `organismFor` (the registry lookups of `catalog/organism.ts` stay); `migrateStoredPageRecord` (what is left is `normalizePageRecord`: the sibling provenance is complete, no v1 conversion, no screen id inferred from a v1 CTA note); the `feed-screen` repair (`repairSession`); `LEGACY_STORAGE_KEYS`, `registerLegacyKey`, `migrateLegacyStorage`; `layoutFromLegacy`; `migrateProposal`, `migrateSessionProposals`, `legacyProposalCount` and the `normalizeProject` hook of modules; `migrateSessionFile`; the migration counters and `window.buildy.migrationReport()`; in `page-contract` the page-spec/v1 TypeScript model (`parsePage`, `parseDraftPage`, the v1 spec and patch checks, the v1 types; the v1 JSON schemas stay vendored because the published session schema still names them).
Kept in `page-contract/types.ts`: the renderer kind vocabulary (`PAGE_BLOCK_KINDS`, `PageBlockKind`), which the catalog generator and the catalog code classify by.
Kept on purpose: `proposalStatus` reads a proposal that only has `applied` (the session schema still allows it, nothing is rewritten), and the chat module's `legacyKeys` (ADR 0044: the flat chat keys of a session document stay valid in the contract, so they are read into `ext.chat`, never written).

An old value that still arrives is refused with its reason and set aside, never converted and never dropped:

- a stored page record in page-spec/v1: quarantined as `page_v1_unsupported` (the rest of the blob loads);
- a stored chat the schema refuses (`feed-screen` origin and the like): quarantined as `session_invalid:<keyword>`, the rest loads;
- a session file with a v1 page: `page_v1_unsupported` with the path (`$.sessions[0].page.applied`), Settings shows a sentence (`settings.importOldPage`), a copy of the file text goes to quarantine, the projects here are unchanged;
- a key of a build before `buildy:v1` (and `buildy:v1:layout`): its value goes to quarantine as `old_storage_key`, then the key is removed, once (`quarantineOldKeys`; a refused quarantine write keeps the key for the next load).

Tests: the migration tests are deleted with the code; the v1 fixtures the other tests read became page-spec/v2 fixtures (`fitness-applied-v2.json`, `food-applied-v2.json`, `north-harbor-v2.json`, made once with the removed migration); new tests pin the refusals above.

## Consequences

- A browser with a page-spec/v1 record or old keys sees them in Settings > Quarantine (and can download them); nothing is rebuilt from them. A support path, if one is ever needed, is a script outside the app.
- `@buildytech/ports` now names `PageV2`.
- The session schema keeps v1 `page` records valid (published, additive-only contract); the app refuses them at the door.

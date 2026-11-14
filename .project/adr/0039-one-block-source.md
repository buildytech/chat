# ADR 0039: One block source, one generator, roles generated

Status: accepted, 2026-11-14. Owner decision: plan item 1 of `docs/plans/refactor-2026-11.md` (audit B-01, B-02, B-03).
Extends ADR 0012 (unified catalog snapshot) and ADR 0037 (header and footer are informational).

## Context

The block list lived in several stores. Two commands wrote them (`snapshot:derive` for the graph artifacts, `registry:sources` for
`sources.json` / `props.json`), the lock did not cover the second pair, and nothing in the unit tests failed when one store lagged.
The header / footer role was copied four times: `policy.pageKindOfBlock`, `policy.pageKinds`, `PAGE_BLOCK_KINDS` and a `chromeRole()`
function in `page-doc/items.ts` (plus a second kind set in `renderer-kind.ts`).

## Decision

- One derivation, `scripts/lib/catalog-artifacts.mjs` (`derived(root, graph, policy)`), returns the exact bytes of every derived
  artifact: `catalog/coverage.json`, `snapshot.json`, `search-index.json` (graph + policy) and `sources.json`, `props.json`
  (pinned registry files, `scripts/lib/registry-derive.mjs`). `npm run snapshot:derive` writes all five and the lock;
  `npm run snapshot:check` compares all five with a fresh derivation byte for byte (and still runs `registry-snapshot --check` on the
  raw CLI tree). `registry:sources` and `catalog:index` are removed; `registry-snapshot.mjs` keeps only the network capture and its check.
- `scripts/m4-api-tests/catalog-artifacts.test.ts` (in `npm test`) derives in memory and fails on drift, names the drifting file, and
  fails when an item or block exists in one artifact and not in the others (graph, `sources.json`, `props.json`, `snapshot.json`,
  the search index, the registry files).
- Role and kind: the only hand-written classification is `catalog/policy.v0.json` (`pageKindOfBlock`, `kindRoles`). The renderer kinds
  are derived from `pageKindOfBlock`; the generator writes each block's `role` (`header` | `footer` | null) into `snapshot.json`;
  `itemInfo().role` reads it. `chromeRole`, `policy.pageKinds` and the second kind set are gone. Roles stay informational (ADR 0037).
- Why the policy and not Stock: Stock and `props/v0.json` carry no header / footer fact. The `role` facet is a page-story role
  (opening, value, proof, ...); the `job` facet marks 12 items as navigation or footer including a cookie banner, an error page
  and a page intro, and bottom navigation is a footer in the agent's vocabulary while Stock tags it as navigation. A rule over those
  tags would change the agent item list. Four `kindRoles` entries, validated against the graph on every `snapshot`, are the honest minimum.
- `PAGE_BLOCK_KINDS` stays in `page-contract` only as the closed enum of the v1 page model (validation, migration, the vendored
  schema); no catalog code reads it any more except the `page-contract:` fallback of `getBlockDetails`. It goes with the v1 model
  in plan item 4. The contract fingerprint now hashes the derived renderer kinds.

## Consequences

- A catalog change is `npm run snapshot` (network) or `npm run snapshot:derive` (policy edits), then `npm run bundle:runtime`
  (the runtime entries embed the snapshot); one command per case, one check.
- The byte content of `sources.json` and `props.json` did not change; `snapshot.json` gained a `role` field per block (non-null for 7 blocks, from
  `kindRoles`); coverage stays 526/532.

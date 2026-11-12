# Plan: UI8Kit-aligned chat UI refinement

Status: planned, owner-approved direction (2026-11-12). Documentation is recorded; UI implementation is not started.

Authority: [ADR 0028](../../.project/adr/0028-chat-ui-refinement.md), extending
[ADR 0026](../../.project/adr/0026-chat-ui-skin.md). Acceptance:
[UI SLO](../../.project/slo/chat-ui-refinement.md). Follow `.cursor/rules/00` through `05`, `AGENTS.md`, and the
current [ADR 0024](../../.project/adr/0024-agent-free-build-layout.md) Build layout.

## Goal and ownership

Deliver a finished, coherent compact workspace: clear surface hierarchy, quiet purposeful edges, consistent
typography and geometry, a unified composer and understandable first-use/status content. Density is intentional.
Concept images guide visual relationships rather than exact dimensions or additional features.

- `apps/chat-web/src/app`: registry-based composition, alignment, grouping, interaction and disclosure.
- `apps/chat-web/src/styles/chat-skin.css`: one shell theme, semantic tone mapping, edge roles and radius scopes.
- `apps/chat-web/src/app.css`: imports, correctly layered base typography, existing app radius scale.
- `apps/chat-web/src/lib/i18n/{en,ru}.json`: UI wording; existing catalog data supplies display names.
- `src/lib`: logic only; existing storage adapters remain the sole persistence path.

Keep `registry/svelte`, generated catalog snapshots, page/session schemas and model tools unchanged. Do not introduce
an app primitive library, literal template wording/colors, arbitrary fixed-size classes, new storage keys or a new
framework gate. Keep the documented runtime dimension exception for splitters/preview geometry.

## Implementation sequence

### 1. Establish browser evidence and repair typography

- [ ] Establish a green baseline: install the declared dependencies with the supported Node version, diagnose the
  existing registry digest/derived-source check failures through the pinned generator workflow, then run verify and
  registry:check. Do not hand-edit generated files or conceal a pin mismatch. Record any separate repair explicitly.
- [ ] Capture the current first-use, conversation, catalog and workspace states at full and compact desktop widths;
  include both themes, locale and pane state. Use local fixtures rather than a live paid turn.
- [ ] Inspect computed control typography and trace the unlayered `font: inherit` reset in `app.css`.
- [ ] Move base inheritance to its proper layer; confirm `text-xs`, `text-sm`, weight and line-height utilities win
  where intended. Do not replace the brand font before assessing the corrected rendering.
- [ ] Establish intended label/body/helper roles and verify their use in the touched components.

Exit: UI-01 evidence, successful project verification, recorded before/after computed styles. Subsequent alignment
work uses the corrected typography rather than compensating for the reset.

### 2. Unify the composer and model controls

- [ ] Refactor `ChatComposer.svelte` into a single input surface and stable bottom action row. Use registry
  composition; extract meaningful regions into Block-rooted components if needed by the one-Block-per-path rule.
- [ ] Keep Ask/Build and model choice clear; align send/stop independently of wrapped labels. Move Add model into
  the model menu while preserving dialog entry, keyboard behavior, Escape and focus return.
- [ ] Show the model once in the main view. Put its ID, usage and technical details in accessible disclosure;
  retain visible actionable errors and distinguish persistence from runtime connection state.
- [ ] Define nested radius scopes and the single input boundary/focus treatment in the shell theme. Verify contrast
  on actual surfaces; document any changed boundary strategy in ADR 0026's current-policy addendum and its tests.
- [ ] Cover onboarding and thread variants, draft preservation, IME, send/cancel and long EN/RU labels.

Exit: UI-02 through UI-04 for the composer, without lost actions or weakened accessibility requirements.

### 3. Refine first use and conversation

- [ ] Recompose `HomeOnboarding.svelte` with a shared alignment strategy for introduction, context and composer.
- [ ] Eliminate the duplicate selected-scenario badge while retaining selection, inspection and clear/removal.
- [ ] Resolve screen display titles from existing catalog metadata; keep IDs available in details and as fallback.
  Keep collection intake chips, removal and existing meaning intact.
- [ ] Replace implementation-oriented welcome prose and contradictory status wording in EN/RU dictionaries.
- [ ] Refine `ChatThread.svelte` / `ChatMessage.svelte`: readable response hierarchy, compact user presentation,
  secondary actions, bounded line length when wide, alignment with the composer and detailed usage disclosure.
  Check real Markdown, proposals, plans, catalog cards and long messages rather than abstract bars.

Exit: useful first-use and conversation screenshots in both themes; all contextual actions still reachable.

### 4. Apply the same visual grammar across the shell

- [ ] Align navigation, `CreatorTopBar`, `ChatColumn` tabs and `WorkspaceHead`; distinguish selection, hover, focus
  and disabled states while keeping 40px bars and compact controls.
- [ ] Refine `PreviewPane` chrome (device, path, skin, open window) using the same geometry. Keep preview sizing,
  page rendering, theme isolation and Apply/Discard behavior.
- [ ] Refine `BlocksFeed`, `FeedCard`, `StockCard`, `StockMediaCard` and `SectionsList`: titles first, technical
  metadata secondary, consistent card geometry/actions, quiet borders. Consolidate secondary filters with explicit
  disclosure if useful; show active conditions and preserve result counts, clear, pagination and per-card reasons.
- [ ] Refine `InspectorSlideOver`, `InspectorPanel` / fields, Settings and menus with the same surface/radius/state
  roles. Keep schema-derived field definitions and inspector gates.
- [ ] Preserve thumbnail content and actual page styles. Do not add label mappings or change generated catalog data.

Exit: one coherent shell across the main surfaces, with no regression in add/drop/reorder, edits or history.

### 5. Complete acceptance and deliver

- [ ] Run the SLO matrix; record visual evidence, browser metadata and unresolved issues below.
- [ ] Check mounted tab panels retain draft/scroll, shortcuts/splitters work, and page data survives reload.
- [ ] Check keyboard/menu/disclosure/dialog flows; focus remains visible; touch exposes secondary actions.
- [ ] Check preview, clean mode, `/preview`, Custom Skin and ZIP isolation; verify registry files are untouched.
- [ ] Run `npm run verify` and `npm run registry:check`. Adapt obsolete source-shape assertions only when the
  approved presentation changes, preserving meaningful behavioral and contrast coverage. No baseline growth.
- [ ] Review diff and docs, then commit verified slices as `Codex <codex@openai.com>` and use a
  normal fast-forward-safe push to `main`, without a PR or history rewriting.

## Acceptance evidence (pending)

For each completed slice append: commit, affected SLO IDs, commands/results, browser/version, viewport in CSS px,
zoom, theme, locale, pane state, fixture/reproduction steps and screenshot paths. Record outstanding cases honestly.
Use durable repository-relative evidence links for checked-in evidence; owner-local reference paths are context only.
Do not store credentials or private session content in screenshots or fixtures.

No implementation acceptance evidence exists yet. Documentation verification is separate from UI acceptance.

### Documentation baseline observation (2026-11-12)

The documentation task ran against `51c3792` with no changes to app, package, catalog, registry or script files:

- `npm run verify`: 95 page-contract tests passed; unit test loading failed because `ajv` was not installed. The
  command consequently did not reach svelte-check or build. Host Node was 24.11.1; the repository declares 22.x.
- `npm run registry:check`: failed with four findings: variants SHA mismatch, props SHA mismatch, stale `props.json`
  and stale `sources.json`. These are observations of this checkout, not proof of a damaged published registry;
  check raw-byte/line-ending handling as well as pins before choosing a repair.
- UI implementation, browser measurements and screenshots remain pending. These baseline failures are not waived
  acceptance criteria and do not count as successful verification of the future refactor.

## Separate functional follow-ups

Preview zoom/100% navigation and the simulated address field's navigation semantics need their own functional
design. They are not added to this visual refactor. No restoration of the pre-ADR-0024 inspector column, new runtime,
schema rewrite, catalog enrichment or live-model execution is authorized by this plan.

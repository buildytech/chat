# Plan: refactor 2026-11 (one block source, project/chat split, chat as a module, quality gate)

Status: accepted by the owner (2026-11-14); audit done; item 3 done ([b545857](https://github.com/buildytech/chat/commit/b545857), ADR 0038); item 1 done ([f69bb81](https://github.com/buildytech/chat/commit/f69bb81), [ec9e4a9](https://github.com/buildytech/chat/commit/ec9e4a9), ADR 0039); item 2 done ([95383f4](https://github.com/buildytech/chat/commit/95383f4), [4e4063c](https://github.com/buildytech/chat/commit/4e4063c), contract [fda5f32](https://github.com/ui8kit/contract/commit/fda5f32), ADR 0040); item 6 gate part done ([6799043](https://github.com/buildytech/chat/commit/6799043), [b3ea302](https://github.com/buildytech/chat/commit/b3ea302), [02c8080](https://github.com/buildytech/chat/commit/02c8080), [f9b562d](https://github.com/buildytech/chat/commit/f9b562d), [d23ccff](https://github.com/buildytech/chat/commit/d23ccff), ADR 0042); item 5 done ([9d48e73](https://github.com/buildytech/chat/commit/9d48e73), [af2bf2d](https://github.com/buildytech/chat/commit/af2bf2d), [6fba14b](https://github.com/buildytech/chat/commit/6fba14b), [b86e623](https://github.com/buildytech/chat/commit/b86e623), ADR 0041); next: item 4 once the owner gives the `migrationReport` numbers, then item 7 (product tails).

Authority: owner decision of 2026-11-14 ("all proposals accepted"). Follow `AGENTS.md`, the ADRs in `.project/adr/` (0034 page-spec v2, 0035 render probe, 0036 map editor, 0037 free composition) and the gate below. Every item that changes a rule or a contract gets its own ADR.

Related: [audit-2026-11.md](audit-2026-11.md) is the defect registry; each defect names the item that fixes it.

Location note: the owner wrote `docs/plan/`; this repository keeps plans in `docs/plans/`, so both files live there.

## Rules for the whole plan

- No issues on any board; this file and the audit are the tracker. Update the **Status** line of an item in the same commit that moves it.
- Each step is a small commit to `main` through the gate: `npm run check`, `npm test`, `npm run build`, `npm run inspector:coverage:check` (coverage stays 526/532 or better), and, when the catalog or schemas change, `npm run snapshot:check` and `npm run schema:check`.
- No behaviour change inside a refactoring step except the one the item names. Staging (`byc-staging-7q4`) is checked after each pushed step.
- Docs and code comments in English.

Execution order: **audit (done)**, then items **3, 1, 2, 5, 6 (gate part), 4**. Item 7 runs alongside as needed. The rest of item 6 (criteria) applies to every step.

## 0. Audit against the item 6 criteria

Goal: know the real defects before moving code.

Acceptance:
- [x] A defect registry with id, file:line, criterion, severity, fix and plan item: [audit-2026-11.md](audit-2026-11.md).
- [x] Counts by criterion and severity; measured facts (cycles, casts, dead code, i18n, sizes, coupling points).
- [x] No code changed by the audit.

Status: done (36 defects: 8 S1, 11 S2, 17 S3). Fixed since: B-04, B-05, half of D-04 (item 3).

## 1. Single block source

Goal: one source for block knowledge, Stock plus `props/v0.json`. The stock registry graph (`catalog/stock-registry.v0.json`) and the agent item index are derived from it, with no hand-kept duplicates (audit B-01, B-02).

Acceptance:
- [x] One generator reads the pinned sources and writes every derived artifact; the six stores listed in B-02 are either generated from it or deleted. (`scripts/lib/catalog-artifacts.mjs`; `snapshot:derive` writes coverage, snapshot, search index, `sources.json`, `props.json` and the lock; `registry:sources` and `catalog:index` removed.)
- [x] Block role and kind are derived: the role is generated from `policy.kindRoles` into `snapshot.json`, the renderer kinds from `pageKindOfBlock`; `chromeRole`, `policy.pageKinds` and the second kind set are gone; roles stay informational (ADR 0037). Two limits, both decided in ADR 0039: `pageKindOfBlock` and `kindRoles` remain the one hand-written classification (Stock and `props/v0.json` carry no header / footer fact), and `PAGE_BLOCK_KINDS` stays as the v1 contract enum until item 4 removes the v1 model.
- [x] `npm run snapshot:check` proves that every derived file is byte-identical to a fresh derivation.
- [x] A test fails when an item exists in one artifact and not in another (`scripts/m4-api-tests/catalog-artifacts.test.ts`, also fails on drift of any single file).
- [x] Inspector coverage unchanged (526/532); the agent item list and the Blocks feed show the same items and the same 7 header / footer roles as before.

Status: done ([f69bb81](https://github.com/buildytech/chat/commit/f69bb81) re-pin, [ec9e4a9](https://github.com/buildytech/chat/commit/ec9e4a9) generator and roles, ADR 0039; staging READY and smoke-checked).

## 2. Session split: Project vs `ext.chat`

Goal: a Project (page, skin, edit history) exists without a chat. Chat messages are an extension (`ext.chat`), and `messages` is optional in the contract (audit A-01, A-02, A-04, A-05, C-01).

Acceptance:
- [x] A Project store owns the page, candidate/applied state, skin, selection and edit history; it does not import chat code. (`lib/project/store.svelte.ts`; a test scans the imports of `lib/project`. The page and candidate state itself stays in `page-store`, which the project store binds, applies and discards.)
- [x] A chat session references a project id; the page blob is keyed by project id. (`Project.projectId`, `bindProject`, `readProjectPage`; the chat is a view of the project, `chat-core/view.ts`.)
- [x] `messages` is optional in the session profile; the contract change is released in `ui8kit/contract` first (session 1.9.0: `messages` optional, `projectId`, `duplicate_project_page`) and `packages/page-contract` follows ([c2aa2cb](https://github.com/buildytech/chat/commit/c2aa2cb)).
- [x] `session.svelte.ts` is split (target under 300 lines per file): the largest file is `turn.ts` at 251 lines and `session.svelte.ts` is a 13-line facade; a test enforces 300. Pure transitions (`project/doc`, `project/transitions`, `chat-core/view`, the proposal normalizer, `proposals`) are plain functions with unit tests (`project-split.test.ts`). The send path and the proposal flow stay in the module-level-rune files and are covered by source-structure tests and the staging smoke.
- [x] Loading, exporting and importing a session file work for old files (until item 4) and for files without messages (`session-store.test.ts`, `project-split.test.ts`; the stored document of a project is byte-identical to what the previous app version wrote).

Status: done ([95383f4](https://github.com/buildytech/chat/commit/95383f4) split, [4e4063c](https://github.com/buildytech/chat/commit/4e4063c) skin to the project store, [a84dff1](https://github.com/buildytech/chat/commit/a84dff1) migration counters, [c2aa2cb](https://github.com/buildytech/chat/commit/c2aa2cb) contract 1.9.0; ADR 0040; staging READY and smoke-checked). Left for later items: the Inspector still reaches `startEmptyPageInChat` through chat-core (A-05, item 5), the Blocks feed and chips still import `chat-core` (A-03, item 5).

## 3. One render probe

Goal: one render-probe function shared by write-time, turn-start and the coverage script, and installed wherever pages are written, the browser included (audit B-04, B-05).

Acceptance:
- [x] One exported `probeFromModule` (compiled registry blocks, `render` to `body`) used by `xai-runtime`, `scripts/inspector-coverage.mjs`, the test helpers and the browser; `probeOutcome` is the one classifier.
- [x] No second copy of the render closure in `apps/xai-runtime/src/http.ts`, the scripts or the tests (a test greps for it).
- [x] A browser write (Inspector edit, drag and drop, feed add) that makes a component throw is rejected with `render_failed` and the prop path, as on the server: the page is unchanged, the field keeps the typed text and shows the error. Decision (ADR 0038): a block that only renders nothing is accepted in the browser (31 registry variants are placeholders: nav bars, footers, FAQ) and the preview keeps its per-block notice; the agent host still rejects it.
- [x] `renderProblems(page)` is computed once per turn step.
- [x] Tests: `render-probe-callers.test.ts` (shared probe, empty policy, write-time, browser Inspector edit and feed add, same verdict for write-time / turn-start / coverage, one closure in runtime / script / browser, one `renderProblems` per turn); coverage unchanged at 526/532 (only the digest line moved).
- [x] Live check: staging, an Inspector edit that makes `dish-showcase` throw shows the field error state with the page unchanged; a feed add of a placeholder block is accepted.

Status: done ([b545857](https://github.com/buildytech/chat/commit/b545857)). Known follow-up: the browser pays one 255 KB gzipped request for `render/blocks.mjs` on first use; revisit if item 5 (chat as a module) changes what loads when.

## 4. Remove the old persist migrations

Goal: delete the page-spec v1 and `feed-screen` migrations (and the other old-data paths) once staging has no old sessions (audit B-06).

How to know (browser data is local, so the server cannot see it): the migration marker `buildy:v1:migration` gets hit counters per path (`pageV1`, `feedScreen`, `legacyKeys`, `proposalApplied`, `lastAt`), and `window.buildy.migrationReport()` prints them. The owner and the team open staging once and report the counters. Removal starts when every reported browser shows zero hits since the counters shipped and the owner confirms.

Acceptance:
- [ ] Counters and `migrationReport()` shipped first, as its own commit, with a test.
- [ ] Removal criterion recorded in this file with the date and the reported browsers.
- [ ] Removed: `migratePageV1` and `page-doc/migrate.ts`, `catalog/props-overrides.ts`, the v1 model in `page-contract` (`types.ts`, `validate.ts`, `spec.ts`) where nothing else uses it, `LEGACY_STORAGE_KEYS` and `migrateLegacyStorage`, the `feed-screen` strip, `migrateProposal`, `migrateSessionFile`.
- [ ] An old file or blob that still arrives is rejected with a clear message and goes to quarantine (nothing is dropped silently).
- [ ] Tests for the migrations are deleted with the code; coverage and gate stay green.

Status: todo (last, after the criterion is met).

## 5. Chat as an optional module

Goal: the core builds and runs with chat off (audit A-03, A-06, F-01).

Acceptance:
- [x] `apps/chat-web/src/modules/chat` holds the chat UI and state; it registers through a `BuilderModule` interface (DIP, `lib/modules/types.ts`); core imports nothing from `modules/chat` (the boundary check fails on it, and also on a module importing another or the core importing the chat-agent package).
- [x] `VITE_MODULE_CHAT` (env, default on) switches the module; `.env.example` documents it. It is a build-time constant (`vite.config.ts` define), so the dynamic import of the module is dropped when off; the `/runtime` proxy and the `/build` alias exist only with the chat on.
- [x] With the flag off, `npm run build` passes and the app opens, edits and exports a project; the bundle has no chat code. Checked on a local chat-off build in headless Chrome: Blocks and Sections only, no "chat" word in the UI or its labels, `/build` opens the builder, feed add, Inspector edit, reload, `buildy.export()` and file download, import of that file into an empty browser, no `/runtime` call, no page errors (26 checks); with the chat on the same smoke passes too (21 checks); the stored and exported project have no chat keys.
- [x] Gate "no trace": `npm run modules:check:trace` (part of `verify`) builds with the flag off and fails if any string only the chat uses is in the build (862 strings: message keys and texts, the chat's wording of core keys, the string literals of the module and of the chat-agent package; a control over the chat-on build finds 730 of them, so the check cannot pass empty). A project stored with the chat keeps them byte for byte through a load and a save with the chat off; a project made with it off gets none.
- [x] Agent, model and usage code leaves `builder-core` for a chat-side package (A-06): `@buildytech/chat-agent` ([9d48e73](https://github.com/buildytech/chat/commit/9d48e73)).

Status: done ([9d48e73](https://github.com/buildytech/chat/commit/9d48e73) chat-agent package, [af2bf2d](https://github.com/buildytech/chat/commit/af2bf2d) module move, [6fba14b](https://github.com/buildytech/chat/commit/6fba14b) port and decoupling, [b86e623](https://github.com/buildytech/chat/commit/b86e623) gate; ADR 0041; coverage 526/532). Decisions worth a review: the core wording is neutral (the brand is βuildγ in both builds; `/build` is a core route, so the builder opens there with the chat off too); the session profile keys `messages`, `mode`, `usage`, `selectedModelId` and the layout pane id `chat` stay in the core as contract and prefs names (ADR 0041).

## 6. Quality criteria and the gate

Goal: the criteria are enforced by the gate, not by memory.

Criteria:
- KISS and DRY: no second hand-kept copy of data or of a helper.
- Light SOLID: one reason to change per package (SRP); the core depends on `BuilderModule`, not on chat (DIP).
- Functional TypeScript over OOP: pure `applyOp` / validate over `@ui8kit/contract` types; state only in thin stores.
- TDD with property-based fuzz: fuzz of ops with schema-random props, and an export snapshot compared with `npx ui8kit add`.
- 12-factor: config in env (including `VITE_MODULE_CHAT`), secrets only in env, stateless API, logs without secrets.

Acceptance (gate part, done before item 4):
- [x] ESLint (flat config): `no-explicit-any`, `import-x/no-cycle` (through Svelte files too), layers and module boundaries (`apps -> packages`, `ports -> page-contract` only, core never imports `src/modules` or chat-agent, a module never another, the app imports nothing outside itself), the Svelte plugin, `max-lines` warning at 300 and `max-lines-per-function` at 80; wired into `npm run check` ([6799043](https://github.com/buildytech/chat/commit/6799043), audit D-01). "Unused exports" is a text-based ratchet in `lint:dead` ([f9b562d](https://github.com/buildytech/chat/commit/f9b562d)), not an ESLint rule.
- [x] `typecheck` script: `tsc --strict --noUnusedLocals --noUnusedParameters` over `packages/*`, `apps/xai-runtime` and `api` (0 errors, D-02), in `npm run check`; `svelte-check` stays for chat-web ([6799043](https://github.com/buildytech/chat/commit/6799043)).
- [x] `ui8px` lint for the UI in the same command: `ui8px` reads no `.svelte`, so `scripts/ui8px-extract.mjs` mirrors the class sets of the Svelte files into html and lints that (controls scope, 8+4 grid; the grid violations are a ratchet, the default allow-list gaps are reported only) ([6799043](https://github.com/buildytech/chat/commit/6799043)).
- [x] A ratchet for `as unknown as` / `as never` / `as Type` (baseline today 16 / 1 / 365 by the script's own count), `localStorage` outside `storage-v1` (2), ESLint warnings (16), and the dead-code counts ([6799043](https://github.com/buildytech/chat/commit/6799043), [f9b562d](https://github.com/buildytech/chat/commit/f9b562d); D-03 to D-05). It may only go down; the numbers are not reduced yet.
- [x] Fuzz test of `applyOp` and the gate (fast-check): valid in, valid out, refusal names problems, base untouched, undo and redo restore, deterministic (`page-ops.fuzz.test.ts`; 1500 + 200 runs found no defect) ([b3ea302](https://github.com/buildytech/chat/commit/b3ea302), audit E-01).
- [x] Export snapshot test against `npx ui8kit add` for three sample pages (blocks of several kinds, a dashboard screen, a landing screen with a registry skin): golden offline, `npm run test:export:live` against the CLI (0 differences) ([b3ea302](https://github.com/buildytech/chat/commit/b3ea302), audit E-02).
- [x] i18n unused-key check (B-11: 117 keys removed, 0 left) and dead-file check (B-08: 4 files removed, 0 left) in the gate; unused exports (B-10) are a ratchet at 207; B-09 (code only tests use: gateway client, session map, mode, vercel-fetch) stays open ([f9b562d](https://github.com/buildytech/chat/commit/f9b562d)).
- [x] 12-factor: `.env.example` complete, one typed config module per app (`apps/chat-web/config.js`, `apps/xai-runtime/src/config.ts`), env read nowhere else; logs without secrets (a sink inventory and a canary run, which found and fixed a leak of the xAI key into the function log and the 500 response) ([02c8080](https://github.com/buildytech/chat/commit/02c8080), F-01). Direct `localStorage`: 2 reads left in the ported magazine theme (F-03 half); the catalog pins import outside the app is gone ([d23ccff](https://github.com/buildytech/chat/commit/d23ccff), A-07).
- [ ] Cleanup items of the audit marked S3 are done as the areas are touched; none is left without an owner item. The open ones (size warnings C-02 to C-04, B-07, B-09, B-10, F-02, F-03 rest, E-03) are listed in the audit with their owner (item 7 and the areas they touch).

Status: done except the last line, which is a rule for later work ([6799043](https://github.com/buildytech/chat/commit/6799043), [b3ea302](https://github.com/buildytech/chat/commit/b3ea302), [02c8080](https://github.com/buildytech/chat/commit/02c8080), [f9b562d](https://github.com/buildytech/chat/commit/f9b562d), [d23ccff](https://github.com/buildytech/chat/commit/d23ccff); ADR 0042). Also in this round: the brand is βuildγ in both builds and `/build` opens the builder with the chat off ([dbe0c4d](https://github.com/buildytech/chat/commit/dbe0c4d)).

## 7. Open product items (kept, not part of the refactor)

- [x] Stale buildy digest pin in Stock: Stock `buildy.v0.json` re-pinned in [9eeabca](https://github.com/codegen-x/ui8kit/commit/9eeabca), chat pin refreshed in [f69bb81](https://github.com/buildytech/chat/commit/f69bb81) (audit B-03).
- [ ] Currency and minor units upstream (in the contract and Stock; no local workaround).
- [ ] Preview error alert contrast.
- [ ] JSON-as-text failure (a model answers with JSON as plain text instead of calling the tool).
- [ ] Six rich-text `__html` variants: delete or rework (owner decision; the BuildY guarantee protects the frontend).
- [ ] `addScreen` sample props for navbar and footer placeholders.

Status: open; each line is closed in the commit that fixes it.

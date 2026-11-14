# ADR 0042: The quality criteria are enforced by the gate

Status: accepted, 2026-11-14. Owner decision: plan item 6 of `docs/plans/refactor-2026-11.md` (audit D-01 to D-05, E-01, E-02, F-01, F-03, B-08, B-10, B-11, A-07).

## Context

The criteria (KISS and DRY, light SOLID, functional TypeScript, TDD with fuzz, 12-factor) were kept by habit: no linter, a type check of
only what chat-web imports, no property-based tests, no check of the export against the CLI, no config module, no log check.

## Decision

`npm run check` runs, in this order, and `npm run verify` adds the tests, the build and `modules:check:trace` (ADR 0041):

1. `typecheck`: `tsc --strict --noUnusedLocals --noUnusedParameters` over `packages/*`, `apps/xai-runtime` and `api` (`tsconfig.typecheck.json`; tests are not part of it).
2. `lint`: ESLint 10 flat config (`eslint.config.js`). `no-explicit-any` and `as any` are errors; `import-x/no-cycle` runs through `.svelte`
   files too; layers are errors (`page-contract <- ports`, `page-contract <- builder-core <- chat-agent <- apps`; the core of chat-web never reaches
   `src/modules` or `chat-agent`, a module never another module, the app imports nothing outside `apps/chat-web`, so the catalog pins come through a Vite `define`);
   the Svelte plugin; `max-lines` 300 and `max-lines-per-function` 80 as warnings. Generated files (`static/render`, `registry`, `catalog`, `api`) are not linted.
3. `lint:ratchet` (`scripts/check-ratchet.mjs`, `scripts/ratchet-baseline.json`): counts that may only go down: `as unknown as`, `as never`, other `as T`,
   `localStorage` outside `storage-v1`, ESLint warnings. `--update` lowers, never raises.
4. `lint:dead` (`scripts/check-dead.mjs`): unused message keys, files nothing imports, exports nothing mentions (text based, conservative); keys and files are at 0, exports are a ratchet.
5. `lint:ui8px` (`scripts/ui8px-extract.mjs`): `ui8px lint` reads only html, css, templ and go, so the class sets of our `.svelte` files are mirrored into
   `.ui8px/extract/*.html` and linted there with the `controls` scope (8+4 grid, the dense IDE of ADR 0017). The grid violations (UI8PX001) are a ratchet;
   UI8PX002 (class not in the generated default allow-list) is reported, not gated, because the policy is not curated for this app.
6. `svelte-check` of chat-web.

Tests added to `test:unit`: `page-ops.fuzz.test.ts` (fast-check: random op sequences with props taken from the Inspector's own field model, valid in / valid
out, refusal names its problems, the base page is never modified, undo and redo restore, ops are deterministic; `FUZZ_RUNS`, `FUZZ_SEED`), `export-cli.test.ts`
(the exported registry files, config and lock for three sample pages equal the golden output of `npx ui8kit@3.5.0 init` + `add`; `npm run test:export:live` runs the CLI
and checks the golden file is current), `logs-secrets.test.ts` (every log sink is a known one that names no secret; a run with canary secrets and a provider
error that echoes them writes none to a log or a response), `gate.test.ts` (the ratchet counter, the extractor, env reads only in config modules, every variable in `.env.example`).

12-factor: one typed config per app (`apps/chat-web/config.js`, build time; `apps/xai-runtime/src/config.ts`, the only `process.env` read); the environment is
read nowhere else (a test), every name is in `.env.example` (a test).

## Consequences

- The audit's "habit" facts are now failures. The first run found 19 lint errors (fixed), one secret leak (a provider error text repeated the xAI key into the function log and the 500 response; `safeErrorMessage` now removes the configured secret values and `xai-` keys), one import outside the app, 117 unused message keys and 4 dead files (removed).
- Deferred on purpose and held by ratchets: 16 size warnings, 365 plain assertions, 16 `as unknown as`, 2 `localStorage` reads in the ported magazine theme, 207 unused exports (about 50 of them in the ported magazine theme and the gateway client that only tests use), 26 grid violations (z-index and size tokens outside the default scale).
- `tsc` over tests, `import-x` unused-export rules and a curated ui8px policy are possible later steps; none is needed to keep the ratchets honest.

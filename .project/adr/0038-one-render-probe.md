# ADR 0038: One render probe, in every place a page is written (browser included)

Status: accepted, 2026-11-14. Owner decision: plan item 3 of `docs/plans/refactor-2026-11.md` (closes audit B-04, B-05).
Extends ADR 0035 (render probe gate).

## Context

ADR 0035 made the write gate render what it accepts, but only on the server. The closure `(organism, props) -> html` was
written three times (`apps/xai-runtime/src/http.ts`, `scripts/inspector-coverage.mjs`, and again in two test helpers), and the
browser installed no probe at all: an Inspector edit, a drag and drop or a Blocks feed add was checked against the schema only,
so a value such as a currency symbol (the component calls `Intl.NumberFormat`) was accepted and the preview showed an error
block. The turn-start check computed `renderProblems(page)` three times per turn. `probe.ts` also used Node's `Buffer`, so it
could not run in the browser.

## Decision

- One function builds the probe: `probeFromModule(module)` in `packages/builder-core/src/page-doc/probe.ts`, over a compiled
  block module `{ blocks, render }` (`RenderModule`). `probeOutcome(result)` (`throws | empty | content`) is the one
  classifier. The runtime, the coverage script, the tests and the browser all call them; none writes a render closure.
- The browser loads the SAME compiled blocks as the runtime: `scripts/build-render-bundle.mjs` also copies
  `api/runtime/_render/blocks.mjs` to `apps/chat-web/static/render/blocks.mjs` (gitignored; `predev` and `prebuild` of chat-web run
  it, so does the Vercel build command). `apps/chat-web/src/lib/preview/render-probe.ts` imports that file and installs
  `probeFromModule(it)`. One compiled file means one verdict on both sides; no client-side `mount` variant exists to drift.
- `loadPropsGate()` loads the props gate and the probe together, before any write path (Inspector, feed add, drop, send). The
  idle prefetch takes the props gate only: the probe bundle (1.8 MB, 255 KB gzipped, one request) is fetched on first use, not on
  every visit. Until it is installed the probe is fail-closed (`render_probe_unavailable`), like the props gate.
- `renderIssues` renders only the blocks a write adds or changes. A write with nothing to render (rename, move, remove) is no
  longer failed by a missing probe: nothing was left unchecked.
- Policy on a failed probe, per host (`installRenderProbe(fn, { required, empty })`):
  - A component that throws (`render_failed`) is refused everywhere. In the browser the edit is not applied and not lost: the
    page is unchanged, the input keeps the typed text, the field shows the error state with the reason and the path of the
    prop (same as a schema rejection), and the next valid value goes through. Block operations and adds answer with the same
    message in the block's issue line.
  - A block that renders nothing (`render_empty`): `empty: "reject"` on the agent host (the model must write content),
    `empty: "allow"` in the browser. 31 of the 532 registry variants (navigation bars, footers, FAQ, signup wizard, bottom
    nav) render nothing with their registry sample props: they are placeholders the author fills in. The Blocks feed must keep
    adding them, and the preview keeps its per-block "renders nothing" notice (`data-slot="render-empty"`).
  - Pages already stored or imported with a broken block are not rewritten; the preview keeps its per-block error state
    (`data-slot="render-failed"`) for them, and only a write that touches the block is probed.
- Turn start: `renderProblems(ctx.page)` is evaluated once per turn; the result serves the prompt and the nudge.

## Consequences

- `probe.ts` is browser-safe (no `Buffer`; `TextEncoder` / `TextDecoder` for the V8 Intl byte quirk).
- Coverage stays 526/532; the only change in `catalog/inspector-coverage.json` is the digest (the Inspector message tweak).
- `apps/chat-web/static/render/` is a build output; a checkout without it fails closed in the browser until `npm run dev` or
  `npm run build` makes it.
- The browser pays one 255 KB gzipped request the first time a write path is used.
- Tests: `render-probe-callers.test.ts` (shared probe units, empty policy, write-time, Inspector edit refusal and feed add in
  browser mode, same verdict for write-time / turn-start / coverage, one closure in runtime / script / browser, one
  `renderProblems` per turn), `render-probe.test.ts`, `render-recovery.test.ts`, `inspector-coverage:check`.

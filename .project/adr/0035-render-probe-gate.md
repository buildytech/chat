# ADR 0035: The write gate renders what it accepts (render probe) and the preview never shows a blank block

Status: accepted, 2026-11-13. Follows ADR 0034 (page-spec 2.0). Replay of the owner's session 1e1031a ("Some blocks are not shown").

## What went wrong

A nine-block delivery page passed `write_page`; two blocks showed nothing in the preview: `delivery-info/split` (later replaced by `zone-table/table`, still blank) and `dish-showcase/grid4`. Rendering each block the way the preview does (the registry component through Vite SSR) found exactly those: `dish-showcase` and `zone-table` threw `RangeError: Invalid currency code` because the model wrote a currency symbol (a rouble sign) into `currency` and the component passes it to `Intl.NumberFormat`, which wants an ISO 4217 code. The props schema says only `text` for `currency`, so the schema gate accepted it. The preview has no error handling around a component: a throw left a blank, with no reason, and the model, told "it does not render", guessed (swapped the block, the same props came along). Other blocks of the page were fine.

Scanning every item + variant with the sample props the host adds found a second class: 31 combinations render nothing or no text (`faq-split`, `bottom-nav`, `signup-wizard`: empty list means empty HTML; `nav-bar`, footers, `category-nav`: no labels), accepted by the gate.

## Decisions

- Render probe (`page-doc/probe.ts`): the runtime renders every block a write adds or changes with the compiled registry components (`api/runtime/_render/blocks.mjs`, built from `registry/svelte` by `scripts/build-render-bundle.mjs` with the same Svelte compiler and inlined server runtime; generated, git-ignored; `npm run bundle:runtime` and the Vercel build command make it; the bundled entry loads `../_render/blocks.mjs`, the node server the same file). A throw is `render_failed`, a result with no text and no image / icon / media / control is `render_empty`; both are write_page issues `{ path, code, expected, got }`. `path` is the prop whose value the error names (`/blocks/2/props/dishes/0/currency`; V8 writes some Intl error arguments one byte per character, undone before matching), else the block's `props`; `render_empty` names the empty lists. Blocks a write leaves unchanged are not probed, so an old page with a blank block can still be edited elsewhere; `get_page` and the first prompt list the current ones as `renderProblems`.
- Fail closed: the runtime requires the probe; without the module every write fails with `render_probe_unavailable` (a page is never accepted on a check that did not run). The probe is installed by `ensureRenderProbe` (http.ts) and only there: pure page logic, the inspector and the browser keep the schema gate.
- The preview shows a visible state instead of a blank: `PreviewBlock` wraps the component in `<svelte:boundary>` whose failed state names the item, variant and the error, and says when a block renders nothing (not in the clean preview window).
- Loop guard: the identity of an error list is code, path and the rejected value (it was code and path only), so trying another value at the same path is a new attempt; the same list twice still ends the turn. A live run on the owner's prompt ended `write_stuck` once while the model was trying currency values.
- The bundler fails on an import cycle and on a re-export it does not understand (ADR 0034 follow-up).
- Tests: `render-items.test.ts` writes every item + variant with its sample props through `write_page` and renders the accepted ones through the Vite + Svelte pipeline of the preview (nothing accepted may throw or be blank; a render rejection must be confirmed by the preview), and renders the owner's nine blocks before (two throw) and after the currency fix (all render); `render-probe.test.ts` covers paths, empty lists, unchanged blocks and the missing probe; `runtime-bundle.test.ts` runs the bundled entry end to end with the probe.

## Consequences

A page that passes `write_page` renders something in the preview and the export (both run the same registry components with the same props). The model gets the path of the prop to fix in the same turn instead of a blank page. Open upstream: the registry props schema should say `currency` is an ISO 4217 code (codegen-x), and prices are minor units (`price: 450` is 4.50); the probe catches the throw, not the meaning.

## Addendum, 2026-11-13: a turn with something to fix may not end silently (owner session fail-aa57f99)

The page of session 1e1031a still had two blocks that threw. Two later turns (Build "blocks do not render, fix or replace", then Ask) read blocks (`get_block` only), made no `write_page`, and answered "fixed: currency=RUB". The page did not change. The probe and `renderProblems` were already live; the gap was the host letting a reply stand that no accepted write backed.

- The first prompt and `get_page` list `renderProblems` of every block of the current page (not only blocks a write touches), in Build and Ask, with a one-line note that these blocks throw or show nothing now. The session file does not record prompts or tool results; `render-recovery.test.ts` rebuilds the prompt for this page.
- Nudge: a turn that has something to fix (open `renderProblems`, or Build with selected blocks) and ends with no accepted write gets one host message inside the same turn, within the step budget: nothing changed, call `write_page` or say plainly that you are not changing the page and why, do not report a change `write_page` did not accept. The signal is program state (open problems, a selection, no accepted write), never words of the reply; Build still does not read Ask prose.
- Status line: a reply without a proposal shows "No changes were made to the page." (`message.noChange`, en and ru) under the text, whatever the text says. An accepted `write_page` whose diff is empty counts as no write.
- The usage record of a normal run was always `incomplete` (reason `error`); it is `complete` unless a request did not report usage.
- Tests: `render-recovery.test.ts` replays this page with a model that repeats the no-write claim (nudged once, no proposal, no nudge when there is nothing to fix) and with a model that writes `RUB` (one accepted write, no problems left); `render-items.test.ts` renders all nine blocks of the page after the fix (prices are minor units: `450` renders as 4.50) and shows exactly two throw before it.

## Addendum (session 5c155d3): Build forces a tool call

The model printed a whole page document as text and never called write_page. Build now sends `tool_choice: "required"` on every
step, and the turn ends with the first accepted write_page (no extra model step; the diff and the status line come from the host).
A step that still comes back as plain text is nudged once ("call write_page with the page document, do not print it") and the next
request forces `{"type":"function","function":{"name":"write_page"}}` (docs.x.ai lists it under tool choice; a 400/422 falls back to
`required`). Ask stays on `auto`. No text is parsed for a document. A write that fails validation keeps the localized
"page not changed (code)" line. Consequence: the empty-required-text fill hint of an accepted write no longer gets a follow-up step.

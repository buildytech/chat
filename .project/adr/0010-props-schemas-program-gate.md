# ADR 0010: Published props schemas are the program gate for registry blocks

- Status: Accepted
- Date: 2026-11-10
- Extends: [0008](0008-registry-single-source-of-ui.md) (registry snapshot, variants pin)
- Owner: chat-first plan approved 2026-11-10; WP FastY Builder (chaosbun#145) refactors later from these results
- Source: chaosbun#138 published `https://registry.buildy.tw/props/v0.json` (JSON Schema 2020-12 per block, with events and slots)

## Context

The chat derived block props from the TypeScript `XxxProps` types of the Svelte files (regex parsing) and checked a
few fields with its own rules: an icon allowlist scraped from `lucide-icons.ts`, icons accepted only on feature rows,
and defaults guessed from TS type text. That let invalid props through (47 of 532 variants rendered with an icon
`"Icon"`, page copy written into enum axes such as `checkout-form.summary`, required `actions.cta` missing under a
variant preset) and rejected harmless input (a Dashboard run failed 6 of 6 on icons sent to nav and activity rows).

## Decision

1. **Pin.** `registry/props.v0.json` is the verbatim published file. `npm run registry:snapshot` accepts it only when
   its sha256 equals the `.sha256` sidecar and `manifest.json` `props.sha256`, and its `digest` equals the manifest
   and `sha256:` of the compact JSON of the file without `digest`. `registry/snapshot.json` records url, sha256,
   digest and item count. `npm run registry:check` re-verifies all of it offline and requires a schema per variants item.
2. **One shape.** `packages/builder-core/src/catalog/props.json` stores each shared `$def` once (lossless: `--check`
   rebuilds every item schema byte-for-byte). Prop names, text / list / object / enum kinds, record fields and the
   defaults of required props are read from the schema (`props-schema.ts`); the TS parsing is gone.
3. **Validate the merge.** Variant presets are partial. Render props are `fill(merge(variant preset, page content))`,
   where `fill` completes required props from the schema (`default`, first enum value, smallest value of the type).
   The merged result of every top-level registry block is validated with Ajv 2020 in strict mode
   (`props-gate.ts`) inside `validateCatalogProvenance`, so propose_layout, every page-patch op (set_variant, set,
   set_items, add, replace) and the browser gate all go through it.
4. **Errors for the model.** `props_invalid` names the block, the registry item and variant, the page field the
   value came from (`children[2].copy.icon`) and the JSON Pointer, and lists the allowed values from the schema enum
   inline (for icons: the contract's `lucideIcon` enum). Branches of reference shapes (`{"$": ...}`, `{op, args}`)
   are not reported. There is no icon list, synonym table or intent word list in the chat.
5. **Fail-closed, lazy in the browser.** The gate is installed by importing `@buildytech/builder-core/props-gate`.
   The runtime installs it at start; the browser loads it as its own chunk before the first proposal. Without it a
   page with a registry block is rejected (`props_gate_unavailable`).
6. **Events and slots are not data.** They stay next to the schema; the props never carry them (the schema rejects
   `onadd` as an extra prop) and the exported section wires each event to a handler stub.
7. **Model context from the schema.** `catalogSources.blocks[*]` carries `rows` / `text` / `events` / `slots`
   summaries from the schema instead of hand-written hints; `icons` is the schema enum.

## Consequences

- A new or changed block needs no chat code: a new snapshot updates the shape, the defaults and the gate.
- Data ops in variant presets (`{op, args}`) are dropped like dictionary refs; the schema fills the prop.
- The browser main chunk grows by the compact schemas (about 30 kB gzip); Ajv (about 42 kB gzip) loads lazily.
- WP FastY Builder can reuse the same file, digest checks and gate semantics (chaosbun#145, phase 2).

## Follow-up (staging acceptance)

- Dashboard `unknown_screen` 6/6 was program-side: the first send from the home screen created the chat and reset the
  picked scenario, so the run went out with `scenarioId: null` and `unknown_screen` had no pool to suggest from.
  The new chat now keeps the picked scenario and screen; without a scenario, `unknown_screen` suggests the nearest
  renderable catalog screens, and the tool-loop failure names the screen ids that were sent.

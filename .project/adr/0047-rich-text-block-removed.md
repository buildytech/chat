# 0047. The rich-text block is removed

Status: accepted (owner t198u)

## Context

`rich-text` was the one registry block whose props carried trusted markup (`{ __html }`), so six of its variants (card, heroTitle,
media, narrow, sidebar, wide) could not be edited in the Inspector (526 of 532 covered). A page never carries markup (page-spec v2
refuses it), so the block could not be authored in the chat either.

## Decision

- The block is deleted at the source, not hidden here: codegen-x removed the spec, the generated runtimes, the hosts and the Stock
  content (codegen-x `466225e`, `a4c5beb`); `registry.buildy.tw` was rebuilt without it (ui8kit/site `f79307e`): `rich-text` is in no
  `index.json` and `npx ui8kit add rich-text` no longer resolves.
- The chat re-pins to those commits (`catalog/snapshot.config.json`), so catalog, snapshot, search index, props and the vendored
  registry tree lose the block. Screens: one Stock screen page (`theme-content-blog/page`, a page of rich text only) went with it, 80
  screens become 79; no other screen used the block.
- Inspector coverage is 526 of 526 and the `markup` field kind and the `trusted_markup` gap reason are deleted from `props-schema.ts`
  and `scripts/inspector-coverage.mjs` (no schema has a `{ __html }` object any more).
- Not touched: the WP FastY builder catalogs (`builder-registry/<latte|twig>/wpfasty/v*`, immutable versions of a separate product)
  still list their own `rich-text` template; the generic `TrustedHtml` runtime of codegen-x stays.

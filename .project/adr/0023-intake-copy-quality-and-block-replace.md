# ADR 0023: Collection intake copy quality, and block replacement in the Ask plan

Status: accepted (2026-11-11). Follows ADR 0022 (collection intake draft) and ADR 0020 (Ask plan, Apply in Build).

## Context

After ADR 0022 the first Build turn of a Stock collection chat cost about 4k tokens in one step, but the model often
left the catalog's own copy on the page: in live runs every grill page kept the host hero text and most site pages
kept the stock feature rows. Row icons outside the published Lucide enum cost a whole repair round (about 8k tokens),
and the model wrote years (`© 2024`, "since 1985") the author never gave. Separately, Ask could only describe "use the
store hero instead of the hero" in prose: replacing a block by another catalog block was not a plan op.

## Decision (A: intake copy)

- Placeholders are found by comparison, never by word lists: `placeholderFields(page, draft.stock)` compares the
  proposal with the draft page the host assembled from the catalog alone (copy keys except badge / href / note, rows
  whose titles all equal stock rows, and titles that are only the kind or catalog block name). What is left is said in
  warnings (`placeholderWarning`). Footer contact / legal defaults are the honest "not invented" lines, not placeholders.
- Measurement showed the model left copy out, not that it copied it: the general `propose_layout` schema says the
  host falls back to catalog copy. The intake turn now gets `intakeTools(draft)`: the same tool from the one
  definition file, with `blocks` narrowed to one schema per draft block (its kind, catalog block, allowed variants)
  whose visible copy keys and rows are required (min 3 rows), row fields per the kind's slot, no `edit` flag. The
  prompt no longer repeats copy keys, rows or variants (the schema carries them) and shows the draft's placeholder
  values per block. Still one tool, one step, no extra fill round.
- A section title that only names the kind ("Hero") takes the model's own headline at pre-placement.
- Years: `stripInventedYears` drops a model-written sentence with a 19xx / 20xx year the author did not write, on every
  block (footer as before); the intake legal field asks for no year. Only text the model wrote this turn is touched.
- Icons: `resolveIconName` maps near-misses to the published Lucide names (case, separators, `lucide-` / `-icon`,
  plural, one unambiguous typo) and drops the rest before the props gate, said in warnings: no repair round for icons.
  Addendum (icon-any): the registry pins every glyph of Lucide (1890 names, codegen-x 9e57f9c renders them through npm
  `lucide`), so the model no longer gets a name list: `catalogSources.icons` and block details say "any Lucide icon name
  in kebab-case" (`LUCIDE_ICON_HINT`) and the host checks against the full published set.
- The run response carries `modelFields` (field names per block, never values) so intake runs can be audited.

## Decision (B: replace in the Ask plan)

- `replace {blockId, catalogBlock, variant?}`: another Stock catalog block of the same kind takes the block's place
  (block.hero -> block.storehero). Checked on the page and the pinned catalog: the catalog block must render as the
  block's kind (`catalog_block_kind_mismatch`, allowed = renderable blocks of that kind), the variant must be one of its
  variants (`unknown_variant`, allowed = its variants), it needs a page renderer (`no_renderer`); the same block and
  variant is a "keep" row (`no_change`).
- `swapCatalogBlock` keeps id, kind, title and summary, and carries every text field the new block's registry props
  read (the organism mapping that also feeds the viewMap origins, ADR 0021); copy keys and row fields it does not read
  are dropped and named (`dropped`: `eyebrow`, `rows.icon`, `rows`). The card shows "Drops: ..." before Apply.
- Apply in Build runs it with the other ticked ops, no model call; `dropped` is recomputed on the page as it is then,
  so hand edits since the plan are carried (and a field cleared by hand is no longer reported); an op that no longer
  applies is rejected while the others apply (partial). Reply text comes from `describePageChanges` (new `block`
  from/to) plus the dropped line.
- Contract, additive: page-patch/v1 `replace.catalogBlock` (page-spec 1.2.0) and plan op `catalogBlock` / `dropped`
  (session 1.5.0), ui8kit/contract `ca0164b`, vendored byte-identical (`npm run schema:check`). Build's `edit_page`
  can use the same op.

## Live measurement (staging byc-staging-7q4, grok-4.20 non-reasoning, 2026-11-11 UTC+3)

Placeholders counted with `placeholderFields` against the local draft for every run (hero and features).

| Commit | Collection | Runs | Runs with hero/features placeholders | Steps | Total tokens | Icon drops | Year strips |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bca744b (before) | site | 3 | 3 (features rows 3/3, hero 1/3) | 1 | 4,231-4,303 | 0 | 1 (footer) |
| bca744b (before) | grill | 4 | 4 (all hero fields) | 1 | 4,292-4,321 | 0 | 0 |
| 693a760 (placeholder hints only) | site / grill | 4 / 4 | 4 / 3 | 1 | 4,368-4,500 | 0 | 1 |
| 54ae0a0 (required copy schema) | site | 4 | 0 | 1 | 4,485-4,526 | 1 run (wheat) | 1 (hero eyebrow) |
| 54ae0a0 (required copy schema) | grill | 4 | 0 | 1 | 4,463-4,530 | 3 runs (chef-hat; fish, salad, flame, cake) | 0 |

One step in every run, no repair round; about +200 tokens per turn (the model now writes the copy: completion
about 170-280 before, 400-530 after). Ask -> replace -> Apply (a7db94b): Ask proposed `replace block-hero` with
`block.storehero/overlay` (3 steps, 12,304 tokens, get_block calls), the card said "Drops: eyebrow", Apply in Build ran
with 0 model calls, status executed, the page rendered `storehero/overlay` with the model's headline, lede and action.

## Consequences

- Placeholder detection works for any topic and language; nothing topic-specific was added.
- Open: the model still picks Lucide names outside the published enum (chef-hat, flame); they are dropped and said.
  A collection chat's replace is checked against the catalog, not the collection bounds (storehero is outside the
  bakery collection); bounding Ask plans by the collection is a follow-up.

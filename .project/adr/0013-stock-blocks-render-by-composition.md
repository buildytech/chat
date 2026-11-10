# ADR 0013: Stock blocks render by screen composition; strict screen support

- Status: Accepted
- Date: 2026-11-10
- Extends: [0012](0012-unified-catalog-snapshot.md) (unified snapshot), [0008](0008-registry-single-source-of-ui.md) (registry is the only UI), [0010](0010-props-schemas-program-gate.md) (props gate)
- Owner: delegated 2026-11-10 (render more Stock blocks honestly; no block dropped silently)

## Context

After ADR 0012 every Stock block (112) has a registry item, but only 25 had a Page DTO kind and 5 of 80 screens
rendered fully. Logos, testimonials, pricing, FAQ, team, steps, proof, quote and video sections fell off a page
without a trace. The assembler also built one page block per Page DTO kind from the unordered, alphabetical
`labels.blocks`: a screen with features and stats (both `features`) rendered one of them, and the catalog block of a
kind was the alphabetically first label (`faq` before `features`). `screenSupport()` accepted screens that dropped
blocks (`site/pricing` without its tiers, `site/notfound`).

## Decision

1. **The Page DTO kind is a slot shape, the catalog block is what renders.** `policy.v0.json` `pageKindOfBlock` maps
   a Stock block to the Page DTO kind whose slots it fills. List sections (heading + rows: logos, testimonials,
   pricing, faq, team, steps, proof, quotesplit, videos) map to `features`. Preview and Code render the block's own
   registry item through `catalogBlock` (`organismFor`), with props validated by `props/v0.json` (fail closed). The
   page-spec contract (kinds, slots) does not change.
2. **Screen composition from data.** `snapshot.json` screens carry `layout`: the `screen-contains-block` edges of the
   graph (each Stock block once, in screen order, with the variant the screen sets and its region `before` / `area`
   / `after`). Block index entries carry `jobs` (the job facet of their variants).
3. **One page block per Stock block.** The assembler builds one page block per Stock block of the screen; a kind
   appears once, except `features`, where every block of that shape renders side by side in screen order. Each page
   block records its `catalogBlock` and the screen's variant.
4. **No invented rows.** The page's placeholder rows go only to the list section tagged with the job `features`
   (Stock data). Every other list section gets its Stock title and an empty-state lede, shown through the block's
   own `empty` / `labels.empty` prop; non-English pages get the localized lede. Model content for a kind lands on
   the block that names the same `catalogBlock`, else on the kind's own block (`block-<kind>`).
5. **Strict support.** `screenSupport()` is true only when every Stock block of the screen renders and the body has
   at least one block that is not app-shell chrome. A screen that would drop a block is not supported:
   `propose_layout` rejects it with the dropped labels (`screen_not_renderable`, Dashboards keep the partial page and
   list them in `missing` / warnings). Ranking counts rendered body blocks.

## Consequences

- Coverage (`catalog/coverage.json`): Stock blocks with a Page DTO kind 25 -> 34, fully rendered screens 5 -> 10
  (`site/pricing`, `theme-marketing-landing/home`, `/studio`, `/events`, `theme-support-center/faq` added).
- Landing and Website seeds pick `theme-marketing-landing/home` (logos, features, steps, stats, testimonials, FAQ).
  Website has no own facet yet: its owner filter stays `job: hero`. A site-type / intent facet in Stock is the fix
  (chaosbun#146), not a word list here.
- Still without a kind: 78 Stock blocks (authpage, newsletter, products, posts, article, ...). Their screens are
  reported as not renderable instead of rendering a hollow page.

# ADR 0034: page-spec 2.0, a page is a document of registry blocks, and one write tool

Status: accepted, 2026-11-13. Replaces the page model of ADR 0010 / 0013 / 0020 / 0022 / 0023 / 0024 / 0027 / 0030 / 0031 / 0033 (page-spec 1.x: kinds, copy slots, props overrides, plan ops). Kept: the props gate (0010), the catalog snapshot (0012), the inspector UI (0014 / 0032), the Stock search (0024), the advisory family as a feed hint (0027), the session standard (0015), the ZIP export 1:1 with `npx ui8kit add` (0008, 0016).

## What went wrong

Two owner sessions (fitness and food, both 3933dbf) showed the same structural problem: the agent edited a page through a model of its own (page kind, copy slots, props overrides, a plan of ops) that is not the exported page. The fitness Ask answered with prose and no proposal, then a no-op "no change" and a Build that rebuilt the page in several runs; the food Build spent 3 runs and about 105k tokens, showed service strings (`Value`, `By line`, `Closing band`) in the preview, never found the dish screens, accepted Lucide names that do not exist (`home`, `lamb`, `chicken`) and titled the page "Marketing landing".

## Decisions

- A page is the export document: `{ version: 2, title, slug, locale, seo, blocks: [{ id, item, variant, props }] }`. `item` is the `npx ui8kit add` registry name, `props` are the full effective props of the block validated against the pinned registry props schema (`registry/props.v0.json`). The preview, the Code pane, the inspector and the ZIP read the same `blocks[].props`. Contract: ui8kit/contract 2.0.0 (9c687c1), 2.0.1 (df52199, 64 prop keys), 794eac5 (`{}` allowed in prop strings).
- Hard rules only: JSON Schema of the document, the props schema of the item, a renderer exists, a header is first and a footer last when there are any. The screen family is derived and only ranks the Blocks feed.
- One write tool `write_page({ page } | { patch })`: a full page or an RFC 6902 patch over the page (`page-patch/v2`). Reads: `get_page`, `search_catalog` (general Stock search, supported screens only), `get_block` (item, variants, props schema, sample props). Tool definitions stay in `agent-tools.v1.json`.
- Failures are `{ path, code, expected, got }` per issue: unknown icons name the nearest real Lucide names, an unknown item or variant lists the allowed ones. The same error set twice ends the turn and writes nothing; a full write of a page is all-or-nothing.
- A new or swapped block takes the registry sample props of its variant (no placeholders, no host text); an item swap keeps the variant if the new item has it, else its default. A required text prop that is empty is said to the model once (`empty_required_text`), never filled by the host. A render of an empty required text is humanized only at render time (`effectiveProps`), never stored. `previewHideServiceLabels` hides the service chrome only; no service string is ever page content.
- Scope: with blocks selected only those blocks may change (`outside_scope` otherwise); with none the whole page including title, slug, seo and locale. Locale follows the language of the request.
- Ask and Build share one proposal: a per-block diff (`added | removed | moved | changed`, per page field) with Apply. A write in Ask makes a proposal, never a page change; the card's "Apply in Build" re-gates it against the base revision with an identical diff and applies it as one undo step without a model call. Build never parses Ask prose and never infers a mode from words.
- Migration: `migratePageV1` builds the v2 document from the v1 render (`organismFor`, the same props the preview showed) and heals v1 fill-ins and service strings (`healV1Props`). Stored page records, the pages blob and imported session files migrate on load; the session schema is 1.8.0, additive (`proposal.diff`, `baseRevision`, `ask-proposal`). v1 blocks without a registry item are skipped on migration (said in the migration notes).
- Screen support is registry-based (`catalog/compatibility.ts`): a screen is supported when every block resolves to a registry item. That is what makes the dish, dishstrip, menuboard and quickorder screens appear for a food request in the general search without topic data in the code.

## Removed

`propose_layout`, `edit_page` and its op taxonomy, `propose_plan` and plan repair, `no_change` rows, `kind` / `family` hard checks, copy slots and props overrides as a write model (the 1.x reader stays in migration only), collection intake draft and placeholder detection, `placeholder.ts`, brief / occasion / title heuristics, `writableOrigin` and the other overrides helpers, 16 v1 test files and 3 v1 fixtures. Kept: collection chips (a collection chat opens Build with the chips), the vite ZIP export, `lib` without `.svelte`.

## Replays (deterministic, scripted model, `scripts/m4-api-tests`)

- Fitness (`page-agent.test.ts`, session fitness-v2-3933dbf): Ask makes one proposal in 3 requests (features grid replaces the logos, stats plain4 replaces the quote split, steps row and pricing grid added, no `no_change`); Apply is one step with sample props; Build "fill with fictional content" is one `write_page` over 8 blocks in 2 requests (hero quoteStats props, seo, title and locale ru, no service strings); the 1.x session migrates and renders the same props.
- Food (`food-agent.test.ts`, session food-3933dbf): field mapping shows no placeholder or service string once props are set; a food search ranks the food screens first by facets and text alone; the Build assembly and content are one `write_page` in 3 requests and 3300 scripted tokens (was 3 runs and about 105k), title from the request, locale ru, hero image from the sample; icons `home`, `lamb`, `chicken` are rejected with paths and nearest names and then fixed (4 requests); replacing a block with a dish block takes the dish sample props.

## Consequences

One document model for chat, preview, code and export; the agent's failures are short, located and actionable; Ask and Build differ only in who may write. Open: a raw Russian brief used verbatim as a search query does not match the English catalog vocabulary (the model translates the query); v1 pages with non-registry blocks lose those blocks on migration.

# @buildytech/page-contract

Canonical **versioned Page DTO** (`layout.version` **1**) for SI Chat and the visual Builder.

This package is the structured layout document written to the Page Store. It is **not** a Codex v0.4 entry: Codex records (content kinds, manifests) and this Page layout DTO stay distinct.

## Compatibility (v1)

| Field | Rule |
| --- | --- |
| Schema | `layout.version === 1`. Any other version is rejected. Unknown keys at every object are rejected. |
| Status | `draft \| pending \| scheduled \| published \| archived \| trashed` (PagePort). Ordinary **draft creation** uses `parseDraftPage` (status must be `draft`). `parsePage` keeps published and the other statuses valid for load/save. |
| Blocks | Closed `kind` allowlist from implemented Preview components: `nav`, `nav-link`, `hero`, `features`, `feature`, `menu`, `dish`, `hours`, `cta`, `footer`, `pagehead`, `overview`, `metrics`, `metric`, `chart`, `activity`, `activity-item`, `sidenav` (dashboard sidebar column; children `nav-link`), `bottomnav` (mobile-only tab bar; children `nav-link`). |
| Copy | Closed keys matching Preview + generated Svelte Code (`eyebrow`, `headline`, `lede`, `action`, `note`, `brand`, `contact`, `legal`, `days`, `address`, `value`, `badge`). `value` is a display figure on a `metric` tile or chart point; `badge` marks demo data. Plain text only; no HTML/PHP markup. |
| IDs | `^[a-z][a-z0-9-]{0,62}$`, unique in the tree. Safe to interpolate into generated Svelte (`data-block-id`). |
| Slug | Ordinary page slug `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1–48 chars. No UTM/query variants. |
| Bounds | Max depth 4, max 64 blocks, bounded string lengths, max ~64k serialized payload. |
| URLs | Dangerous schemes `javascript:`, `data:`, `vbscript:`, `file:` are rejected on every string, including whitespace-obfuscated forms. A value that *starts* with a URL scheme (spaces kept) may only use `http`, `https`, or `mailto`. Prose with a colon (`QA Landing 1109: …`, `Hours: 11:00`) is not a URL. |

Consumers **must** run `parsePage` / `parseDraftPage` at the external Store boundary. TypeScript casts are not validation.

```ts
import { parsePage, parseDraftPage } from "@buildytech/page-contract";

const page = parsePage(unknownPayload); // any PagePort status
const draft = parseDraftPage(unknownPayload); // status === "draft"
```

TypeScript `parsePage` / `parseDraftPage` is the product validator (see `fixtures/conformance-cases.json`). Do not fork limits, kinds, or error codes.

**Known follow-up (not M2):** the v1 plain-text rule rejects `<>{}` in every string. That is stricter than some legitimate copy (comparisons, examples). Broaden only in an explicit contract review — persistence must not silently loosen it.

Out of this contract: multilanding, UTM, checkout, Codex equivalence, Gateway, publish, WordPress import, portable multi-host export envelope ([ADR-0007](../../.project/adr/0007-one-buildy-three-hosts.md)). v1 is the SPA layout document. This repo does not ship a WordPress or Latte runtime.

See [docs/architecture.md](../../docs/architecture.md).

## Page spec page-spec/v1 and edits page-patch/v1

The Page DTO is published as the page spec profile of `@ui8kit/contract`: [`page-spec.schema.json`](https://schema.buildy.tw/page-spec.schema.json) (root = this Page, so every saved page validates unchanged; `$defs/store` = the browser page store) and [`page-patch.schema.json`](https://schema.buildy.tw/page-patch.schema.json) (edit operations). Copies live in `schema/` (from ui8kit/contract `fa2f15e`); `npm run schema:check` compares them with the live URLs.

- `parsePageSpec(input)` = schema (`page_spec_invalid` + path) then `parsePage` program checks. Proposals, the client gate, saved pages and request bodies go through it.
- `PAGE_SLOTS` (schema `x-page-slots`): copy keys each kind renders and the rows of list kinds. `edit_page` (builder-core `editPage`) writes only slots.
- `src/json-schema.ts` is a dependency-free checker for the keyword subset the schemas use; an unknown keyword throws.

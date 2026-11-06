# @buildytech/page-contract

TypeScript Page DTO for the SI Chat Website Builder and the visual Builder.

Both tools write **ordinary pages**: `kind` conceptually `page`, unique `slug`, `status`, `title`, `layout`, `seo`.

`layout.blocks` is an ordered tree: each node has `id`, `kind`, optional `title` / `summary` / `copy`, and optional `children`. Preview (Svelte) and Code (Latte) project this tree. No second source of truth.

Out of P0: multilanding, UTM variants, checkout/payment, fabricated discounts or stock.

See [docs/architecture.md](../../docs/architecture.md).

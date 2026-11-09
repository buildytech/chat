# Plan: one BuildY product on three hosts

Authoritative decision: [ADR-0007](../../.project/adr/0007-one-buildy-three-hosts.md). This file is the **sequence**. It does not authorize desktop implementation, WordPress runtime in this repo, or a claim that portable import already works.

## Goal

One BuildY product. Three hosts share one pinned CodeGen-X Stock catalog (same identity and provenance) and, later, one versioned page document:

1. WordPress builder page (other product; Latte / PHP **adapter**)
2. BuildY Browser (this repo; Vite / Svelte 5; **finish first**)
3. BuildY Desktop Wails3 (later; same core, not a fork)

Plain acceptance: an inexperienced webmaster asks for something like **dishes / grill / promotion / New Year**, builds a page from Stock, edits it, and does not lose the result.

## Now (implemented in this repo)

Do not describe these as future work.

- Browser Creator SPA: `apps/chat-web` (CreatorShell, ChatCore mock + localStorage, Preview + Code).
- Pinned Stock snapshot: `packages/builder-core` (`catalogProvenance()`, `NOTICE`). Constructor search / propose uses that snapshot.
- Versioned Page DTO for this SPA: `packages/page-contract` `layout.version` **1**. `parsePage` rejects other versions and unknown keys. This is **not** a WordPress import contract.
- UI8Kit composition rules copied from [`ui8kit/contract`](https://github.com/ui8kit/contract) (`.cursor/rules`, `.cursor/skills`). Kit files in `apps/chat-web/src/ui` are generated; do not hand-patch. Identical DOM / ARIA / tokens across eight runtimes is a **contract rule**, not a shipping exporter.
- Code tab: Svelte UI8Kit `page.svelte` from `svelteFromPage`. No PHP/Latte runtime in Browser or Vercel.
- `services/context-serve`: retired CI placeholder. Default `npm run dev` must not require it.
- Protected Vercel static SPA + `/runtime`: `docs/deploy-xai.md`, root `middleware.js` (ESM, `"type": "module"`).
- No WordPress plugin, nonce, or `wp-json` in this repository (ADR-0006, `scripts/m4-api-tests/no-wordpress-runtime.test.ts`).
- Wails3 desktop host is later (ADR-0007). Not a runtime in this repo.

## Sequence (do not skip)

### 1. Finish the functioning Browser

Stay in this repo. Webmaster can run the constructor on Stock, edit the page, and keep the result in the Browser mock (and later a first-class project store — still Browser MVP, not this plan's desktop slice). Do not open Wails3 work while the Browser path is the incomplete product.

CI and local commands stay:

```sh
npm test
npm run check
npm run build
```

Optional: `apps/xai-runtime` / Vercel `/runtime` with Basic Auth. See [runbook.md](../runbook.md) and [deploy-xai.md](../deploy-xai.md).

### 2. Portable export contract (planned)

Define a **neutral, versioned, validated** export of page / layout / content produced by the Browser stack. Follow current `ui8kit/contract` rules (contract first, Block root, retag, static ARIA, tokens). Portability is **data, contracts, DOM, ARIA, tokens**, catalog provenance, and explicit host capabilities.

Not in scope: translating arbitrary Svelte to PHP; assuming `page-contract` v1 is already that envelope; growing UI8Kit baselines; merging Codex v0.4 records into the Page DTO.

The envelope must preserve **IDs**, **ordered blocks**, **variant**, **props**, **content**, **assets**, **provenance**, and **version**. Unsupported versions **fail clearly** (no silent dropped blocks). Migrations / negotiation are specified before any importer ships.

### 3. WordPress import adapter (planned, other product)

A Latte / PHP adapter in the WordPress builder product imports the envelope. PHP / Latte remains an optional host target, not a Browser requirement. This repo still must not take a WordPress runtime (ADR-0006).

### 4. Desktop Wails3 (planned, after Browser)

Copy / adapt the **same** `apps/chat-web` core, Stock snapshot, and contracts into `adapters/wails3`. No second catalog, no second Page schema, no independent ChatCore. Not started by this plan.

### 5. Round-trip tests (future acceptance)

Browser export → WordPress import → semantically equivalent data and preview. **Not implemented.** Do not mark the constructor “multi-host done” until those tests exist.

## Non-goals for this document

- Implementing Wails3, WP plugin, or export/import code
- Changing GitHub workflows or Vercel env
- Rewriting historical ADRs
- Treating Go context-serve or PHP Latte as required to run the Browser

# ADR 0007: One BuildY product, three hosts, shared Stock

- Status: Accepted
- Date: 2026-11-08
- Extends: [0001](0001-cms-agnostic-chat-builder.md) (one Page Store, dual builders), [0003](0003-creator-surfaces-preview-code.md) (CreatorShell / Preview+Code), [0006](0006-browser-first-no-wordpress-runtime.md) (this repo stays browser-first)
- Does not replace: 0006 (no WordPress runtime in this repository), 0002 (SLSA), 0004 (Agent Gateway), current CI or Vercel deploy
- Plan: [docs/plans/one-buildy-three-hosts.md](../../docs/plans/one-buildy-three-hosts.md)

## Context

BuildY is one product. The same webmaster should get the same catalog and keep the same page result on a WordPress builder page, in BuildY Browser (Vite / Svelte 5, this repo), and later on BuildY Desktop (Wails3). The shared content supplier is the pinned CodeGen-X Stock snapshot, with the same catalog identity and provenance.

This repo already ships a browser Creator SPA and a Stock snapshot derived from `codegen-x/ui8kit` (NOTICE, `packages/builder-core` catalog provenance). WordPress Builder lives in other products. `adapters/wails3` is a stub. ADR-0006 forbids a WordPress runtime here. Those facts stay.

Portability is easy to get wrong: shipping Svelte source into PHP, or treating today's Page DTO as already WP-importable, would fork the product. UI8Kit contract rules (`ui8kit/contract` AGENTS, `.cursor/rules` 00–05, 10) require contract-first data, Block root, primitives + `tag` retag, static ARIA, tokens, and identical DOM / tokens / ARIA across the eight runtimes (including Svelte and Latte). Rule 14 (exportable screens) is an end goal; this repo has no exporter yet.

## Decision

### One product, three hosts

| Host | Where it lives | Role |
| --- | --- | --- |
| WordPress builder page | Other BuildY / WP products (not this repo) | Visual builder page; future import of a portable, versioned page document through a Latte / PHP **adapter** |
| BuildY Browser | This repo, `apps/chat-web` | Active Creator SPA. Finish a real functioning browser **first** |
| BuildY Desktop Wails3 | This repo later, `adapters/wails3` | Same browser core and same Stock in a desktop webview. Adaptation / copy, **not** an independent builder or catalog fork |

Telegram Mini App remains an unrelated stub (ADR-0001). It is not a fourth product host in this decision.

### Shared content supplier

All three hosts resolve screens and blocks against **one** pinned CodeGen-X Stock snapshot: same `provider`, `repo`, `pinnedCommit`, `sourceArtifact`, `sourceDigest`, `sourceVersion`, and counts (`packages/builder-core` `catalogProvenance()`, NOTICE). Do not mint a second catalog for desktop or WordPress.

### Sequence (authoritative)

1. Finish the real functioning **Browser** in this repo (constructor + edit + do not lose the result).
2. Define a **neutral, versioned, validated** page / layout / content **export** produced by the browser stack (Bun or Node, Vite, Svelte 5). Current `packages/page-contract` `layout.version` 1 is a layout document for this SPA; it is **not** declared WP-import compatible.
3. WordPress imports that export through a host adapter (Latte / PHP) in the WordPress product. This repo does not gain `wp-json`, nonce, plugin ZIP, or a PHP runtime (ADR-0006).
4. **Then** Desktop Wails3: load the same SPA / ChatCore / Stock / contracts. Do not start desktop implementation in this ADR.
5. **Then** round-trip acceptance: browser export → WP import → semantically equivalent data and preview. Tests are future work. Do not claim they exist.

### Product acceptance (plain language)

An inexperienced webmaster types an ordinary request such as **dishes / grill / promotion / New Year**, gets a page assembled from Stock, can edit it, and does not lose the result when saving or moving the document between hosts that implement the portable contract.

### What portability means

Portable pieces: **data, contracts, DOM, ARIA, tokens**, catalog identity, and explicit host capabilities.

Not portable by translation: arbitrary Svelte components to PHP, kit internals, Vite app chrome, or Node/Go services.

Preserve on export / import: block **IDs**, **order**, **variant**, **props**, **content**, **assets**, catalog **provenance**, and contract **version**. Host-specific adapters and capabilities stay explicit (ADR-0004: UI branches on capabilities, not runtime name).

### Versioning and failure

Unsupported contract or catalog versions **fail clearly**. Do not silently drop blocks, skip unknown kinds, or coerce provenance. Negotiation and migrations are planned; they are not implemented. Today's `parsePage` already rejects a non-1 `layout.version` and unknown keys — that is SPA validation, not the future export envelope.

PHP / Latte is an **optional host target** (CodePort emitter today; WP adapter later). It is not a Browser runtime requirement. Go `services/context-serve` is **optional** (`?live=1`), not the default Browser path.

UI8Kit contract rules in this repo remain in force for composition (Block root, retag, primitives, ARIA, tokens). Do not grow UI8Kit baselines. Codex v0.4 records and the Page layout DTO stay distinct (`packages/page-contract` README).

## Implemented now vs planned

| Now (this repo) | Planned (not done) |
| --- | --- |
| Browser Creator SPA, mock ChatCore, pinned Stock snapshot + provenance | Portable export envelope with version negotiation |
| `page-contract` v1 + `parsePage` (reject other versions / unknown keys) | Declared WP-import compatibility of that envelope |
| Latte **string emitter** in the Code tab (no PHP engine) | WordPress Latte/PHP adapter in the WP product |
| Wails3 **stub** | Desktop copy of the same core after Browser is done |
| Optional Go Session HTTP | Round-trip semantic-equivalence tests |
| No WordPress runtime (guard: `no-wordpress-runtime.test.ts`) | Webmaster acceptance across all three hosts |

## Consequences

- Do not implement Wails3, WP plugin, or schema rewrites in the same breath as this ADR.
- Do not treat CodePort Latte output as a completed WP import path.
- Architecture and operator docs may name the three-host product; CI and `docs/deploy-xai.md` stay the Browser / Vercel instructions they are.
- Historical ADRs stay on disk. 0006 still bans a WordPress runtime **in this repository**.

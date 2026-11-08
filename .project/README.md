# .project

Operator notes for this repository. See `intent.md` when present.

Краткий индекс: продукт, ADR, SLO, SLSA. Архитектура кода — в `docs/`, не дублируем её здесь.

| Path | What |
| --- | --- |
| [intent.md](intent.md) | One-page product intent (Creator shell + optional cursor-sdk) |
| [adr/](adr/README.md) | Architecture Decision Records |
| [adr/0001-cms-agnostic-chat-builder.md](adr/0001-cms-agnostic-chat-builder.md) | Dual builders, Page Store ports, stack split (WP host superseded by 0006) |
| [adr/0006-browser-first-no-wordpress-runtime.md](adr/0006-browser-first-no-wordpress-runtime.md) | Browser-first Creator; no WordPress runtime |
| [adr/0002-supply-chain-slsa.md](adr/0002-supply-chain-slsa.md) | SLSA Build L1 + CI provenance toward L2 |
| [adr/0003-creator-surfaces-preview-code.md](adr/0003-creator-surfaces-preview-code.md) | ChatCore / ChatColumn / CreatorShell; Preview Svelte + Code Latte |
| [adr/0004-agent-runtime-adapters.md](adr/0004-agent-runtime-adapters.md) | Agent Gateway, AdapterRegistry, opt-in `cursor-sdk` |
| [slo/chat-web.md](slo/chat-web.md) | Early-stage SLO: build CI + Creator/ChatCore/Gateway indicators |
| [slsa/controls.md](slsa/controls.md) | P0 supply-chain checklist + build recipe |
| [slsa/verify.md](slsa/verify.md) | How to verify GitHub artefact provenance |

CI:

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — `apps/chat-web` build on push/PR to `main`
- [`.github/workflows/slsa-provenance.yml`](../.github/workflows/slsa-provenance.yml) — P0 provenance / attestation for release artefacts

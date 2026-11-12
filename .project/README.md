# .project

Operator notes for this repository. See `intent.md` when present.

Краткий индекс: продукт, ADR, SLO, SLSA. Архитектура кода — в `docs/`, не дублируем её здесь.

| Path | What |
| --- | --- |
| [intent.md](intent.md) | One-page product intent (Creator shell + optional cursor-sdk) |
| [adr/](adr/README.md) | Architecture Decision Records |
| [adr/0001-cms-agnostic-chat-builder.md](adr/0001-cms-agnostic-chat-builder.md) | Dual builders, Page Store ports, stack split (WP host superseded by 0006) |
| [adr/0006-browser-first-no-wordpress-runtime.md](adr/0006-browser-first-no-wordpress-runtime.md) | Browser-first Creator; no WordPress runtime |
| [adr/0007-one-buildy-three-hosts.md](adr/0007-one-buildy-three-hosts.md) | One BuildY product on Browser, WordPress builder page, Desktop Wails3; shared Stock |
| [../docs/plans/one-buildy-three-hosts.md](../docs/plans/one-buildy-three-hosts.md) | Sequenced plan for ADR-0007 (Browser first; no desktop/WP work in this repo yet) |
| [adr/0002-supply-chain-slsa.md](adr/0002-supply-chain-slsa.md) | SLSA Build L1 + CI provenance toward L2 |
| [adr/0003-creator-surfaces-preview-code.md](adr/0003-creator-surfaces-preview-code.md) | ChatCore / ChatColumn / CreatorShell; Preview Svelte + Code Latte |
| [adr/0004-agent-runtime-adapters.md](adr/0004-agent-runtime-adapters.md) | Agent Gateway, AdapterRegistry, opt-in `cursor-sdk` |
| [slo/chat-web.md](slo/chat-web.md) | Early-stage SLO: build CI + Creator/ChatCore/Gateway indicators |
| [adr/0028-chat-ui-refinement.md](adr/0028-chat-ui-refinement.md) | Accepted UI8Kit chat UI refinement; implementation pending |
| [slo/chat-ui-refinement.md](slo/chat-ui-refinement.md) | Visual, accessibility and regression acceptance targets for ADR 0028 |
| [../docs/plans/chat-ui-refinement.md](../docs/plans/chat-ui-refinement.md) | Sequenced shell refactor and pending acceptance evidence |
| [slsa/controls.md](slsa/controls.md) | P0 supply-chain checklist + build recipe |
| [slsa/verify.md](slsa/verify.md) | How to verify GitHub artefact provenance |

CI:

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — `apps/chat-web` build on push/PR to `main`
- [`.github/workflows/slsa-provenance.yml`](../.github/workflows/slsa-provenance.yml) — P0 provenance / attestation for release artefacts

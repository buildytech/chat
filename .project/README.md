# .project

Operator notes for this repository. See `intent.md` when present.

Краткий индекс: продукт, ADR, SLO, SLSA. Архитектура кода — в `docs/`, не дублируем её здесь.

| Path | What |
| --- | --- |
| [intent.md](intent.md) | One-page product intent |
| [adr/](adr/README.md) | Architecture Decision Records |
| [adr/0001-cms-agnostic-chat-builder.md](adr/0001-cms-agnostic-chat-builder.md) | Dual builders, Page Store ports, stack split |
| [adr/0002-supply-chain-slsa.md](adr/0002-supply-chain-slsa.md) | SLSA Build L1 + CI provenance toward L2 |
| [slo/chat-web.md](slo/chat-web.md) | Early-stage SLO for the runnable SPA |
| [slsa/controls.md](slsa/controls.md) | P0 supply-chain checklist + build recipe |
| [slsa/verify.md](slsa/verify.md) | How to verify GitHub artefact provenance |

CI:

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — `apps/chat-web` build on push/PR to `main`
- [`.github/workflows/slsa-provenance.yml`](../.github/workflows/slsa-provenance.yml) — P0 provenance / attestation for release artefacts

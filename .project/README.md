# .project

Operator notes for this repository. See `intent.md` when present.

Index: product intent, ADRs, SLOs, SLSA. Code architecture lives in `docs/`, not here.

| Path | What |
| --- | --- |
| [intent.md](intent.md) | One-page product intent |
| [adr/](adr/README.md) | Architecture Decision Records (index of all 47) |
| [slo/chat-web.md](slo/chat-web.md) | Early-stage SLO: build CI and the app's indicators |
| [slo/chat-ui-refinement.md](slo/chat-ui-refinement.md) | Visual, accessibility and regression acceptance targets for ADR 0028 |
| [slsa/controls.md](slsa/controls.md) | Supply-chain checklist and build recipe (ADR 0002) |
| [slsa/verify.md](slsa/verify.md) | How to verify GitHub artefact provenance |
| [../docs/architecture.md](../docs/architecture.md) | Code architecture |
| [../docs/plans/refactor-2026-11.md](../docs/plans/refactor-2026-11.md) | Refactor plan and its status; [audit](../docs/plans/audit-2026-11.md) |
| [../docs/plans/one-buildy-three-hosts.md](../docs/plans/one-buildy-three-hosts.md) | Sequenced plan for ADR 0007 (Browser first) |
| [../docs/plans/chat-ui-refinement.md](../docs/plans/chat-ui-refinement.md), [../docs/acceptance/](../docs/acceptance/) | Shell refactor plan and browser evidence |

CI:

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — `apps/chat-web` chat-web build and the Go placeholder on push and PR to `main`
- [`.github/workflows/slsa-provenance.yml`](../.github/workflows/slsa-provenance.yml) — P0 provenance / attestation for release artefacts

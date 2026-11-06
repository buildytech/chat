# ADR 0002: Verifiable technical supply (SLSA)

- Status: Accepted
- Date: 2026-11-06
- Controls: [../slsa/controls.md](../slsa/controls.md)
- Verify: [../slsa/verify.md](../slsa/verify.md)

## Context

Монорепозиторий зелёный (scaffold): runnable artefact — static SPA `apps/chat-web`. Нужна **verifiable technical supply**: оператор должен понимать, *какой* workflow собрал релиз и связать файл с provenance, без претензии на hermetic / L3.

## Decision

P0 цель: **SLSA Build L1 documented + CI provenance toward L2**.

- **L1:** документированный build recipe (этот ADR + workflows) и воспроизводимый путь сборки на GitHub-hosted runners.
- **Toward L2:** hosted GitHub Actions + GitHub artifact attestations (`actions/attest-build-provenance`) на release artefacts. Это не hardened builder и не bit-for-bit reproducibility.

Контрольный путь P0: [`.github/workflows/slsa-provenance.yml`](../../.github/workflows/slsa-provenance.yml) (см. controls.md).

### In scope (P0)

- SHA-pin GitHub Actions (или явная pin policy + CI pin-check).
- Documented build recipe для `apps/chat-web` static output.
- `id-token: write` + `attestations: write` на provenance job.
- Upload release artefact + SLSA provenance attestation.
- Нет секретов в git (`.env` в `.gitignore`; stub orchestrator без live keys).
- Честный gap: нет `package-lock.json` — follow-up для reproducible installs.

### Out of scope (P0)

- Hermetic build (fixed toolchain, no network during compile).
- SLSA Build **L3** (isolated / hardened builders, non-falsifiable provenance).
- Provenance для stub-артефактов (`context-serve`, orchestrator, WP plugin).
- SBOM как gate (optional later; см. controls.md).
- Self-hosted runners, reusable SLSA3 generator (`slsa-github-generator`).
- Подпись git-тегов / GPG commits.

## Consequences

- CI на `main` проверяет, что SPA **собирается**; provenance — на `v*` / Release / `workflow_dispatch`, не на каждый push.
- Пока нет lockfile, installs не bit-reproducible; это зафиксированный gap, не скрытый L2.
- Повышение до L2 «полностью» — после первого реального release artefact и успешного `gh attestation verify`.

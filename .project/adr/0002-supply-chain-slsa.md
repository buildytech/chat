# ADR 0002: Verifiable technical supply (SLSA)

- Status: Accepted
- Date: 2026-11-06
- Controls: [../slsa/controls.md](../slsa/controls.md)
- Verify: [../slsa/verify.md](../slsa/verify.md)

## Context

The monorepo builds green; its runnable artefact is the static SPA `apps/chat-web`. It needs a **verifiable technical supply**: an operator must be able to tell *which* workflow built a release and tie the file to its provenance, without claiming a hermetic build or SLSA L3.

## Decision

Goal: **SLSA Build L1 documented, CI provenance toward L2**.

- **L1:** a documented build recipe (this ADR and the workflows) and a reproducible build path on GitHub-hosted runners.
- **Toward L2:** hosted GitHub Actions and GitHub artifact attestations (`actions/attest-build-provenance`) on release artefacts. This is not a hardened builder and not bit-for-bit reproducibility.

The control path is [`.github/workflows/slsa-provenance.yml`](../../.github/workflows/slsa-provenance.yml) (see controls.md).

### In scope

- SHA-pinned GitHub Actions (or an explicit pin policy and a CI pin check).
- A documented build recipe for the `apps/chat-web` static output.
- `id-token: write` and `attestations: write` on the provenance job.
- Release artefact upload and the SLSA provenance attestation.
- No secrets in git (`.env` is in `.gitignore`; a secret scan runs in the gate, ADR 0043).
- `package-lock.json` is committed, so installs are reproducible (`npm ci`).

### Out of scope

- A hermetic build (fixed toolchain, no network during compile).
- SLSA Build **L3** (isolated, hardened builders, non-falsifiable provenance).
- Provenance for placeholder artefacts (`services/context-serve`).
- An SBOM as a gate (optional later; see controls.md).
- Self-hosted runners, the reusable SLSA3 generator (`slsa-github-generator`).
- Signed git tags and GPG commits.

## Consequences

- CI on `main` proves the SPA **builds**; provenance runs on `v*` tags, Releases and `workflow_dispatch`, not on every push.
- Full L2 follows the first real release artefact and a successful `gh attestation verify`.

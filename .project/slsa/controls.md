# SLSA / supply-chain controls (P0)

P0 control path: [`.github/workflows/slsa-provenance.yml`](../../.github/workflows/slsa-provenance.yml)  
CI build: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)  
Decision: [ADR 0002](../adr/0002-supply-chain-slsa.md)

## Checklist

| Control | P0 status |
| --- | --- |
| GitHub Actions pinned by **full commit SHA** (+ version tag in comment) | **in** — workflows + `pin-check` job in `ci.yml` |
| Dependency lockfile | **in** — root `package-lock.json`; CI uses `npm ci` |
| `id-token: write` + artefact **provenance** | **in** — provenance workflow (`contents: read`, `attestations: write`) |
| Upload build artefact | **in** — `chat-web-spa` tarball of `apps/chat-web/build/` |
| Optional **SBOM** for release artefacts | **out (documented)** — generate later (`npm sbom` / CycloneDX) after lockfile exists |
| No secrets in repo | **in** — `.env` gitignored; a secret scan (history and staged) runs in the gate (ADR 0043) |
| Documented build recipe | **in** — this file + workflows |

## Pin policy

Every `uses: owner/repo@...` in `.github/workflows/` is a 40-hex SHA with the tag in a comment (`# v7.0.1`). A pin update is its own commit on `main`. `pin-check` fails when a ref is not a SHA.

## Build recipe (`apps/chat-web`)

Hosted runner: `ubuntu-latest`. Node: LTS (`lts/*`).

```sh
# repo root (workspaces)
npm ci               # requires committed package-lock.json
npm test             # @buildytech/page-contract
npm run check --workspace=@buildytech/chat-web
npm run build --workspace=@buildytech/chat-web
# SvelteKit adapter-static → apps/chat-web/build/ (+ 200.html fallback)

cd services/context-serve
go test ./...
go build -o context-serve .
```

Release packaging: `chat-web-spa-<git-sha>.tgz` from `apps/chat-web/build/`. The subject of the attestation is this tarball.

Not hermetic: the network is allowed for the npm registry. Not L3: GitHub-hosted, not an isolated hardened builder.

## Provenance job (P0 SLSA path)

Trigger: `workflow_dispatch`, push tags `v*`, GitHub Release `published`.

1. Same build recipe as CI.
2. `actions/upload-artifact` — tarball.
3. `actions/attest-build-provenance` — SLSA provenance, Sigstore (public-good if public repo).

Permissions: `id-token: write`, `contents: read`, `attestations: write` (plus `artifact-metadata: write` for the storage record in v4).

If a Release is created from a new `v*` tag the workflow may start twice; that is acceptable, the subject digest is the same.

## Follow-ups

1. Done: `package-lock.json` (npm workspaces, repository root) is committed and CI uses `npm ci`.
2. Optional SBOM next to the tarball and an attested SBOM predicate.
3. A real L2 claim after the first `gh attestation verify` on a published artefact.

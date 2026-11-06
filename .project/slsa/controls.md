# SLSA / supply-chain controls (P0)

P0 control path: [`.github/workflows/slsa-provenance.yml`](../../.github/workflows/slsa-provenance.yml)  
CI build: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)  
Решение: [ADR 0002](../adr/0002-supply-chain-slsa.md)

## Checklist

| Control | P0 status |
| --- | --- |
| GitHub Actions pinned by **full commit SHA** (+ version tag in comment) | **in** — workflows + `pin-check` job in `ci.yml` |
| Dependency lockfile | **in** — root `package-lock.json`; CI uses `npm ci` |
| `id-token: write` + artefact **provenance** | **in** — provenance workflow (`contents: read`, `attestations: write`) |
| Upload build artefact | **in** — `chat-web-spa` tarball of `apps/chat-web/build/` |
| Optional **SBOM** for release artefacts | **out (documented)** — generate later (`npm sbom` / CycloneDX) after lockfile exists |
| No secrets in repo | **in** — `.env` gitignored; orchestrator stub without live keys |
| Documented build recipe | **in** — this file + workflows |

## Pin policy

Каждый `uses: owner/repo@...` в `.github/workflows/` — 40-hex SHA. Рядом комментарий с tag (`# v7.0.1`). Обновление pin — отдельный commit на `main`. `pin-check` падает, если ref не SHA.

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

Release packaging: `chat-web-spa-<git-sha>.tgz` from `apps/chat-web/build/`. Subject of attestation = этот tarball.

Не hermetic: сеть для npm registry разрешена. Не L3: GitHub-hosted, не isolated hardened builder.

## Provenance job (P0 SLSA path)

Trigger: `workflow_dispatch`, push tags `v*`, GitHub Release `published`.

1. Same build recipe as CI.
2. `actions/upload-artifact` — tarball.
3. `actions/attest-build-provenance` — SLSA provenance, Sigstore (public-good if public repo).

Permissions: `id-token: write`, `contents: read`, `attestations: write` (плюс `artifact-metadata: write` для storage record в v4).

Если Release создаётся с нового `v*` tag, workflow может стартовать дважды — допустимо для P0; subject digest тот же.

## Follow-ups

1. Commit `package-lock.json` (npm workspaces, **корень** репо) → переключить CI на `npm ci`.
2. Optional SBOM рядом с tarball + attest SBOM predicate.
3. Реальный L2 claim после первого `gh attestation verify` на опубликованном артефакте.

# Verify provenance (release artefact)

После workflow `SLSA provenance` (tag `v*` / Release / `workflow_dispatch`) артефакт — tarball `chat-web-spa-*.tgz`. Attestation хранится в GitHub Attestations API (Sigstore).

Нужен GitHub CLI (`gh`) ≥ 2.49 с `attestation` command.

## 1. Скачать subject

С run provenance workflow: artefact `chat-web-spa`. Или с GitHub Release, если attached.

```sh
gh run download <RUN_ID> -n chat-web-spa -R buildytech/chat
# → chat-web-spa-<sha>.tgz
```

## 2. `gh attestation verify` (основной путь)

```sh
gh attestation verify ./chat-web-spa-<sha>.tgz \
  --repo buildytech/chat \
  --signer-workflow buildytech/chat/.github/workflows/slsa-provenance.yml
```

Минимум (слабее): `--owner buildytech` без signer workflow.

Ожидание: predicate type `https://slsa.dev/provenance/v1`, identity = этот repo + workflow. Exit 0 = digest совпал с attestation.

Показать bundle:

```sh
gh attestation verify ./chat-web-spa-<sha>.tgz \
  --repo buildytech/chat \
  --format json
```

## 3. Cosign-style (optional / offline)

Если есть bundle с `gh attestation download`:

```sh
gh attestation download ./chat-web-spa-<sha>.tgz -R buildytech/chat

cosign verify-blob-attestation \
  --bundle <downloaded-bundle.json> \
  --new-bundle-format \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github.com/buildytech/chat/' \
  ./chat-web-spa-<sha>.tgz
```

Cosign не обязателен для P0, если `gh attestation verify` доступен.

## 4. Что проверять глазами

- Subject digest = SHA256 tarball, не «имя файла».
- `builder.id` / workflow ref указывает на `.github/workflows/slsa-provenance.yml`.
- Source commit = git tag / SHA релиза.
- Не доверять артефакту, скачанному не из того run, на который смотрит attestation.

## Gaps

Пока не было ни одного `v*` release, verify не на чем гонять — это ожидаемо для scaffold. Private repo: attestations требуют GitHub Enterprise Cloud; public — доступны на текущих планах.

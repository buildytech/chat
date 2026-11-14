# Verify provenance (release artefact)

After the `SLSA provenance` workflow (tag `v*`, Release or `workflow_dispatch`) the artefact is the tarball `chat-web-spa-*.tgz`. The attestation is stored in the GitHub Attestations API (Sigstore).

Needs GitHub CLI (`gh`) 2.49 or newer with the `attestation` command.

## 1. Download the subject

From the provenance workflow run: artefact `chat-web-spa`; or from the GitHub Release when attached.

```sh
gh run download <RUN_ID> -n chat-web-spa -R buildytech/chat
# → chat-web-spa-<sha>.tgz
```

## 2. `gh attestation verify` (main path)

```sh
gh attestation verify ./chat-web-spa-<sha>.tgz \
  --repo buildytech/chat \
  --signer-workflow buildytech/chat/.github/workflows/slsa-provenance.yml
```

Minimum (weaker): `--owner buildytech` without the signer workflow.

Expected: predicate type `https://slsa.dev/provenance/v1`, identity = this repo and workflow. Exit 0 means the digest matches the attestation.

Show the bundle:

```sh
gh attestation verify ./chat-web-spa-<sha>.tgz \
  --repo buildytech/chat \
  --format json
```

## 3. Cosign-style (optional / offline)

With a bundle from `gh attestation download`:

```sh
gh attestation download ./chat-web-spa-<sha>.tgz -R buildytech/chat

cosign verify-blob-attestation \
  --bundle <downloaded-bundle.json> \
  --new-bundle-format \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github.com/buildytech/chat/' \
  ./chat-web-spa-<sha>.tgz
```

Cosign is not required when `gh attestation verify` is available.

## 4. What to check by eye

- The subject digest is the SHA256 of the tarball, not the file name.
- `builder.id` / the workflow ref points to `.github/workflows/slsa-provenance.yml`.
- The source commit is the release tag or SHA.
- Do not trust an artefact downloaded from a different run than the one the attestation names.

## Gaps

Until the first `v*` release exists there is nothing to verify; that is expected. Private repository: attestations need GitHub Enterprise Cloud; public repositories have them on current plans.

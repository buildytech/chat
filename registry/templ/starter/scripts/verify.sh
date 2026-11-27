#!/usr/bin/env bash
# The gate before every commit and in CI. Needs only Go (and git).
# gofmt, vet, test -race, govulncheck, templ diff, privacy check.
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n== %s\n' "$*"; }

step "gofmt"
unformatted=$(gofmt -l $(git ls-files '*.go' | grep -v '^ui/kit/') 2>/dev/null || true)
if [ -n "$unformatted" ]; then
  echo "not gofmt-ed:"; echo "$unformatted"; exit 1
fi

step "go vet"
go vet ./...

step "go test -race"
go test -race -count=1 ./...

step "govulncheck"
if command -v govulncheck >/dev/null 2>&1; then
  govulncheck ./...
else
  go run golang.org/x/vuln/cmd/govulncheck@latest ./...
fi

step "templ generate is committed"
go tool templ generate >/dev/null 2>&1
if ! git diff --quiet -- '*_templ.go'; then
  echo "templ output differs from the committed files; run make generate and commit:"
  git diff --stat -- '*_templ.go'; exit 1
fi
if [ -n "$(git ls-files --others --exclude-standard -- '*_templ.go')" ]; then
  echo "new *_templ.go files are not committed:"; git ls-files --others --exclude-standard -- '*_templ.go'; exit 1
fi

step "go generate ./internal/page is committed"
go generate ./internal/page
if ! git diff --quiet -- internal/page/sections_gen.go; then
  echo "internal/page/sections_gen.go differs from ui/kit/ui8kit.lock.json; run go generate ./internal/page and commit"; exit 1
fi

step "privacy check (PRIVACY.md)"
./scripts/privacy-check.sh

step "ok"

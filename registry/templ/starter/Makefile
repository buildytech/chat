# Only Go is required for `make run`, `make build` and `make test`.
# `make css` downloads the Tailwind standalone CLI (no Node) on first use.

PRESET ?= shop
HTTP ?= 127.0.0.1:8090
TAILWIND_VERSION ?= v4.3.3

UNAME_S := $(shell uname -s | tr '[:upper:]' '[:lower:]' | sed 's/darwin/macos/')
UNAME_M := $(shell uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')
TAILWIND := bin/tailwindcss

.PHONY: run build generate css test verify privacy clean

run: ## local demo with seed data (never use in production)
	go run ./cmd/site dev --preset $(PRESET) --http $(HTTP)

build:
	CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o bin/site ./cmd/site

generate: ## regenerate *_templ.go after editing .templ files (commit the result)
	go tool templ generate

$(TAILWIND):
	mkdir -p bin
	curl -fsSL -o $(TAILWIND) https://github.com/tailwindlabs/tailwindcss/releases/download/$(TAILWIND_VERSION)/tailwindcss-$(UNAME_S)-$(UNAME_M)
	chmod +x $(TAILWIND)

css: $(TAILWIND) ## rebuild internal/web/static/app.css (commit the result)
	$(TAILWIND) -i ui/styles/app.css -o internal/web/static/app.css --minify

test:
	go test -race ./...

verify: ## gofmt, vet, test -race, govulncheck, templ diff, privacy check
	./scripts/verify.sh

privacy: ## the privacy-by-design gate alone (PRIVACY.md)
	./scripts/privacy-check.sh

clean:
	rm -rf bin pb_data

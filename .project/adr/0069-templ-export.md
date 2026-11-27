# ADR 0069: «Download ZIP» as a Go templ site (fastygo/starter)

Status: accepted, 2026-11-27 (owner answers of 2026-11-27: the starter's Layout, the preset chosen at export, the VibeChat runtime later); phase a (the templ pack) 2026-11-27.

## Context

The ZIP export was the Svelte project only. The owner wants the same page as a Go site on the UI8Kit templ registry (registry.buildy.tw/templ), on the fastygo/starter (Go, templ, PocketBase; presets blog, corporate, shop), and later to run it in VibeChat. The starter is strict: a CSP of `img-src 'self' data:` and `style-src 'self'`, no external fonts or pictures, no inline styles, a privacy check and tests on its public pages.

## Decision

1. **Two formats in one menu.** «Download ZIP» keeps its one click (the last choice) and gets a format menu: Svelte (as before) or Go templ with a preset (blog, corporate, shop). The templ file is `<slug>-templ-<preset>.zip`.
2. **A pinned snapshot, as for Svelte.** `catalog/snapshot.config.json` `templ` pins the starter commit, the registry, the ui8kit CLI and Tailwind (sha256). `npm run snapshot:templ` (network, Go) downloads the starter at the commit, applies `catalog/templ/overlay` and the anchored patches of `scripts/lib/templ-overlay.mjs`, adds every catalog block with `ui8kit add` into `ui/kit`, runs `templ generate` and `go generate`, builds `app.css` with the Tailwind CLI over the starter and all blocks, checks `go vet` and `go build`, and writes `registry/templ/starter` (no `.github`, `bin`, `pb_data`, `vendor`) and `registry/templ/snapshot.json` (pins and a sha256 per file). `snapshot:templ:check` (offline, in `npm test`) checks the files against it. Nothing in it is edited by hand.
3. **The page is data.** `internal/page/page.json` (`buildy.templ-page.v1`) carries the blocks in page order with the props `renderBlock` gives (macros expanded, the same as preview and the Svelte ZIP); texts live there, never as templ literals. `internal/page/sections_gen.go` maps a registry item to its block and props type; it is written by `go generate ./internal/page` (`internal/page/gen`, from `ui/kit/ui8kit.lock.json`) and the export writes the same bytes (`sectionsGo`). `page.Blocks()` renders the page inside the starter's Layout: the home page shows the page's blocks in place of the starter's hero; the starter's sections and store card stay below.
4. **The starter's Layout is the frame.** Header and footer come from the starter (its navigation of the preset's sections); the page's `header-*` / `footer-*` blocks are left out and listed in `manifest.json` `skipped`.
5. **Only the page's blocks.** The ZIP keeps the starter's own registry blocks and the page's catalog blocks; the lock is narrowed to them. `ui8kit add` and `go generate` add more later.
6. **Skin as CSS, pictures as files.** A registry skin is rewritten to `:root` rules, a Custom Skin's variables to one `:root` rule plus Stock's base rules; both go to `ui/styles/theme.css` and are appended to the built `internal/web/static/app.css` (the CSP forbids inline styles; `make css` rebuilds it). The starter's scripts keep mode 0755 in the ZIP (`snapshot.json` `executables`). Downloaded pictures go to `internal/web/static/images` (embedded) and are served as `/static/images/…`; a picture that stayed remote shows the block's placeholder (the CSP serves pictures from the site only) and is listed in the manifest. A Custom Skin's web fonts are only named in the manifest (no font CDN).
7. **One pack format.** `manifest.json` and `GENERATOR.json` of both exports carry `format: "buildy.pack.v1"`, `schemaVersion: 1`, `framework: "svelte" | "templ"`, and `preset` for templ. The Svelte project files are unchanged byte for byte; VibeChat 0.2.7 still imports the Svelte pack (it refuses only chat exports).
8. **The preset.** The Makefile's `PRESET ?=` and `page.json` `preset`; `site dev` without `--preset` on a fresh database takes the page's preset.

## Checks

`scripts/m4-api-tests/templ-pack.test.ts` (offline): the snapshot check; for each preset the studio page's ZIP (manifest, page.json props equal `renderBlock`, the narrowed lock, `sections_gen.go`, the Makefile); header and footer left out; a registry skin as `:root` rules; the Svelte pack's format fields. `templ-pack-go.test.ts` (live: Go and the module proxy): for each preset the ZIP unpacked, `go generate` and `templ generate` change nothing, `go vet`, `go test`, `go build`, `site dev` serves `/`, the preset's sections, the pictures and `app.css` with 200, and `ui8px lint` (go preset) finds nothing in the page's blocks.

## Later

Phase b: VibeChat imports and runs a templ pack (option A, Go inside the owner's slot). Phase c: the starter's own ui8px findings (113 with the go preset on 2026-11-27) and Custom Skin fonts as local files.

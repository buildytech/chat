# starter

A majestic-monolith website starter in Go: **one binary** with PocketBase embedded
as a library (SQLite, migrations, files, superuser admin), server-side rendering
with [templ](https://templ.guide) and UI8Kit primitives, and three presets on one core:

| Preset      | Public sections                      | Extras                                     |
|-------------|--------------------------------------|--------------------------------------------|
| `blog`      | Articles                             |                                            |
| `corporate` | Services, Cases, Articles            | Contact page with the one contact button   |
| `shop`      | Products, Articles                   | Browser-only cart, order request message, one seller contact button |

No Node, no SPA, no payments.

**Privacy by design, no banner needed.** Think of it as a static site with an
editor's cabinet: public pages set no cookies, post nothing, store nothing about
visitors and load nothing from other hosts. The shop cart lives in the browser
tab (`sessionStorage`) and only builds an order request the buyer copies into
the seller's single contact channel. Request logs are off by default
(`SITE_ACCESS_LOG=off`). See [PRIVACY.md](PRIVACY.md) for every switch; enabling
any of them requires updating the privacy policy and agreements first.

## Run locally (only Go 1.27 needed)

```sh
make run                    # shop preset with demo content on http://127.0.0.1:8090
make run PRESET=corporate   # or blog
go run ./cmd/site           # same as `site dev`
```

The demo seed runs only outside production and only for a localhost base URL.
The demo cabinet login is printed on start and written to
`pb_data/demo-credentials.txt` (mode 0600). Set `SITE_DEMO_PASSWORD` to choose it.

- Site: <http://127.0.0.1:8090/>
- Cabinet (admin and editor roles; the only place with a cookie): <http://127.0.0.1:8090/cabinet>
- PocketBase admin (superuser): <http://127.0.0.1:8090/_/>, local only. In production
  it is reachable only through an SSH tunnel (see `deploy/README.md`).

## CLI

```sh
site init --preset shop --brand "Acme Goods" --contact-url https://t.me/acme \
  --contact-label "Write us in Telegram" --contact-variant default --contact-size lg --contact-new-window
site user add owner@acme.example --name Owner --role admin   # cabinet account
site role grant editor@acme.example editor
site superuser upsert root@acme.example '<password>'          # PocketBase superuser
site demo seed [--reset]                                     # local only
site serve --http 127.0.0.1:8090                             # production
```

## Develop

```sh
make generate   # after editing *.templ (generated files are committed)
make css        # after adding classes (downloads the Tailwind standalone CLI once)
make verify     # gofmt, vet, test -race, govulncheck, templ diff, privacy check
make build      # bin/site
```

Read [AGENTS.md](AGENTS.md) before changing code: it is the map of the repository,
its contracts and recipes. Deployment (incus, systemd, Caddy, backups) is in
[deploy/README.md](deploy/README.md). An agent skill that turns this repository into a
branded site is in [skills/site-starter/SKILL.md](skills/site-starter/SKILL.md).

## License

MIT, see [LICENSE](LICENSE). Vendored parts: `ui/kit` (UI8Kit, MIT),
`ui/styles` (see `ui/styles/NOTICE.md`), Istok Web font (SIL OFL 1.1).

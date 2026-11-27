---
name: site-starter
description: Turn the fastygo/starter repository into a privacy-by-design (no cookies, no visitor data, no consent banner) branded blog, corporate site or small shop, verify it and run it locally; deploy to an incus container only after the owner explicitly says yes. Use when someone asks to start, set up or launch a new website from this starter.
---

# Site starter

Works with any coding agent that can run a shell. Needs Go 1.27+ and git. No Node.

## Principle: privacy by design, no banner needed

The result is like a static site with an editor's cabinet. Visitors give the
site nothing: no cookies on public pages, no forms that post, no visitor data
in the database, no third-party requests (self-hosted fonts and images, CSP
`default-src 'self'`), no analytics, request logs off (`SITE_ACCESS_LOG=off`).
So it needs no cookie or consent banner; never add one. The shop cart stays in
the browser tab and only builds an order message the buyer copies into the
one contact channel. Hosting access logs can still contain IPs: keep their
retention short (`deploy/journald-site.conf`, no Caddy access log). If the
owner asks for a contact form, analytics or logs, explain that this changes
what the site collects and needs an updated privacy policy and agreements
(`PRIVACY.md`); do it only after an explicit yes.

## 1. Ask only three things

Ask in one message and wait for the answers. Do not ask anything else.

1. **Preset**: `blog` (articles), `corporate` (services, cases, articles, a contact page
   with the one button) or `shop` (products, cart, order request; no payments, orders are not stored).
2. **Brand name** (and an optional one-line tagline).
3. **The one contact channel** buyers and clients use: an `https://` link
   (Telegram `https://t.me/<name>`, WhatsApp `https://wa.me/<number>`, a form
   on another service), `mailto:<address>` or `tel:<number>`, plus the button
   text ("Write us in Telegram"). Exactly one. Do not offer to add a second
   one: the site shows one button by design.

The button look has defaults (variant `default`, size `lg`, same window); the
owner can change variant (`default|secondary|outline`), size
(`sm|default|lg`), text, link and "open in a new window" (rendered with
`target="_blank" rel="noopener noreferrer"`) later in Cabinet → Settings, with
a live preview.

Everything else (currency, colours, texts) has a sensible default and can be
changed later in the cabinet or in `ui/styles/theme.css` and `ui/dict/en.json`.

## 2. Clone and initialise

```sh
git clone https://github.com/fastygo/starter.git <project-dir>
cd <project-dir>
go run ./cmd/site init --preset <preset> --brand "<Brand>" --tagline "<tagline>" \
  --contact-url "<url>" --contact-label "<button text>"
# optional: --contact-variant default|secondary|outline --contact-size sm|default|lg --contact-new-window
```

`init` rejects contact URLs with other schemes; fix the input, never the validator.

## 3. Brand

- Visible texts: `ui/dict/en.json` (`home.<preset>.*` for the home page hero, `section.*` for section titles).
  Keep keys; change values only.
- Colours: tokens in `ui/styles/theme.css` (`--primary`, `--background`, ...), then
  `make css`. Never put colours in templates.
- Logo text is the brand name from settings; favicon: `internal/web/static/favicon.svg`.
- Follow `AGENTS.md` (contracts) and `.cursor/rules/` (UI8Kit contract) for any
  template change, then `make generate`.

## 4. Verify

```sh
make verify     # gofmt, vet, test -race, govulncheck, templ diff, privacy check: must pass
make run PRESET=<preset>
```

Open `http://127.0.0.1:8090/`, the section lists and one detail page, `/cabinet`
(demo credentials are printed on start and saved in `pb_data/demo-credentials.txt`).
For `shop`: add a product to the cart, open `/cart`, type a name, check that
the message updates, Copy works and there is exactly one contact button pointing
to the owner's channel. For `corporate`: `/contact` shows the about text and the
one button. In the browser's dev tools, public pages must show no cookies and
no requests to other hosts.

Report to the owner: what was set, the local URL, and what to change next.
Demo content is for local preview only; it is never seeded in production.

## 5. Deploy (only after an explicit yes)

Ask: "Deploy to <host> in an incus container now?" Continue only on a clear yes
from the owner for that host. Then follow `deploy/README.md` step by step:
snapshot first, `SITE_ENV=production`, https `SITE_BASE_URL`, no demo data,
superuser and cabinet admin with long random passwords given to the owner
privately (never in chat logs or git), Caddy in front, and the final checks:
`/healthz` 200, `/_/` and `/api/*` 404 from outside, HSTS present, no
`Set-Cookie` on public pages, `SITE_ACCESS_LOG=off`, no Caddy access log,
journald drop-in installed, restic backup set up.

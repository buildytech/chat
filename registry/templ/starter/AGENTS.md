# AGENTS.md

You are working on a small website starter. Read this file first; it is the
whole onboarding. Keep it current when you change structure, contracts or commands.

## 0. Privacy by design: no banner needed

Treat the site as a **static site generator with an editor's cabinet**. The
cabinet is for editors (and for agents building UX/UI); visitors give the site
nothing:

- no cookies on public pages (only `site_session` after a cabinet sign-in);
- no visitor data in the database: no forms that post, no leads, no orders;
- the shop cart lives in the browser tab (`sessionStorage`) and only builds an
  order request text the buyer copies into the seller's one contact channel;
- no third-party requests (fonts, images, scripts are self-hosted;
  CSP `default-src 'self'`), no analytics, no embeds;
- no request logs by default (`SITE_ACCESS_LOG=off`), no Caddy access log.

Because nothing is collected, **no cookie/consent banner is needed, and none
may be added**. Hosting still sees IP addresses (connections, provider
firewall logs); keep those retention periods short. Every place data could be
written, its control and default is listed in [PRIVACY.md](PRIVACY.md).
Turning any of it on is a deliberate decision that requires updating the
privacy policy and agreements first. `scripts/privacy-check.sh` enforces this
in `make verify` and CI.

## 1. What this is

One Go binary (`cmd/site`) = PocketBase as a library + templ SSR + UI8Kit
primitives. One core, three presets (`blog`, `corporate`, `shop`) chosen with
`site init --preset`. No Node, no client framework; `app.js` is small
progressive enhancement (the shop cart needs it; pages without JS show a
notice and still have the contact button).

## 2. Repository map

```
cmd/site/              main.go (PocketBase app, OnServe -> privacy + web), commands.go (init, dev, user, role, demo)
internal/config/       environment (SITE_*), production checks, SITE_ACCESS_LOG (default off)
internal/privacy/      ApplyLogSettings: PocketBase request logs per SITE_ACCESS_LOG
internal/preset/       presets, sections, field kinds: the single source of what each preset has
internal/migrations/   schema; the only place where collections change
internal/content/      settings (incl. contact button look), list/detail queries, markdown, slugs
internal/auth/         cabinet sign-in, roles (admin, editor), cookie session (cabinet only)
internal/shop/         contact URL validation and prefill rules
internal/money/        integer minor units, Format/Parse, Spec for the browser cart
internal/media/        upload -> WebP
internal/security/     CSP nonce, headers, admin guard, same-origin, sign-in limiter (memory)
internal/seed/         demo content (local only)
internal/i18n/         dictionary lookup
internal/view/         typed view models: the contract between data and templates
internal/web/          routes, handlers, middleware, tests (web.go, public.go, cabinet.go)
internal/web/screens/  page templates (layout, public, shop, cabinet) built from blocks
internal/page/         the home page from BuildY Chat: page.json (registry blocks + props), sections_gen.go (go generate)
internal/web/static/   embedded app.css (built), app.js (cart, copy, preview), fonts, favicon
ui/blocks/             UI8Kit blocks: one Block root each, props in doc.go
ui/dict/en.json        every visible string
ui/kit/                vendored UI8Kit (do not edit)
ui/styles/             Tailwind entry, theme tokens, fonts, kit.css
deploy/                deploy guide, env example, systemd unit, journald drop-in, Caddy example
scripts/               verify.sh (the gate), privacy-check.sh
skills/site-starter/   agent skill: brand and launch a site from this repo
.cursor/rules/         UI8Kit contract rules + 20-starter.mdc (this file in short)
PRIVACY.md             every place data could be written, its switch and default
```

## 3. Architecture and data flow

```
request -> guard (admin paths) -> headers (CSP nonce, HSTS in prod) -> handler
handler -> content/auth (PocketBase records) -> view.* models -> screens.* -> blocks -> ui/kit
```

- Handlers never pass `*core.Record` to templates. Convert to `internal/view` types.
- Templates never query data and never contain literal user-facing text.
- Public pages show only records with `status = published`. `/media/...` serves
  files of published records only (signed-in users see drafts).
- Public routes are **GET only**. The only POSTs are cabinet routes (sign-in,
  content, settings), all same-origin checked.
- Collections: one per section (`articles`, `cases`, `services`, `products`),
  `settings` (single record), `users` (cabinet accounts with `role`). All
  collection API rules are `nil` (superuser only); the site reads and writes
  through the Go app, never through the public REST API.
- Shop: `/cart` renders a JSON catalog (`<script type="application/json"
  id="cart-catalog">`: published, in-stock products with database prices) and
  the message words; `app.js` reads the tab's cart (`sessionStorage`
  `site-cart-v1`, slug → qty), renders lines from a hidden prototype row,
  builds the message, copies it and prefills mailto/WhatsApp links.

## 4. Contracts (do not break)

1. **Privacy by design** (section 0, PRIVACY.md): no public cookies, no public
   POST, no visitor data stored, no third-party requests, logs off by default,
   no consent banner. Tests: `assertPrivate`, `TestShopCartIsBrowserOnly`,
   `TestAccessLogModes`, `TestDefaultsArePrivate`; gate: `scripts/privacy-check.sh`.
2. **`/_/` and `/api/*` are never public.** `security.IsAdminPath` + `AdminAllowed`:
   allowed only from `SITE_ADMIN_ALLOW` peers *and* without forwarding headers;
   otherwise 404. `/api/health` is the only exception. Production access = SSH tunnel.
3. **Superuser = PocketBase superuser.** The cabinet uses `users` with roles
   `admin` (content, settings) and `editor` (content).
   Password auth through the PocketBase API stays disabled on `users`.
4. **Exactly one contact button** per page where it appears (cart/order page,
   seller card on product pages and the shop home, corporate `/contact`), all
   from settings: `contact_url` (`https:`, `mailto:`, `tel:` only —
   `shop.ValidContactURL`), `contact_label` (button text), `contact_variant`
   (`default|secondary|outline`), `contact_size` (`sm|default|lg`) — the UI8Kit
   link-button recipe — and `contact_new_window`, which renders
   `target="_blank" rel="noopener noreferrer"`. Never add a second channel or a
   fallback link. The footer has no contact link on purpose.
5. **Schema changes only through new files in `internal/migrations/`** (never
   change collections in `/_/` on a live site).
6. **Images are WebP.** Uploads go through `media.ToWebP` (max width 1600).
7. **Text from the dictionary.** Add keys to `ui/dict/en.json`; `dict_test.go`
   fails on missing keys and unknown Lucide icon names.
8. **Generated files are committed**: `*_templ.go` and `internal/web/static/app.css`.
   `make verify` fails if `templ generate` changes anything.
9. **Demo data is local only.** `site dev` and `site demo seed` refuse production
   and non-localhost base URLs.
10. **No secrets in git.** Configuration is environment (`deploy/site.env.example`).

## 5. UI rules (UI8Kit contract, short form)

Full rules: `.cursor/rules/0*.mdc`, `10-contract-package.mdc`.

- One block = one `.templ` file in `ui/blocks/` with exactly one `@c.Block` root;
  never a Block inside a loop (repeated parts are their own block, e.g. `item-card`).
- Only kit primitives (`c.Stack`, `c.Grid`, `c.Text`, `c.Title`, `c.Link`,
  `c.Button`, `c.Card`, ...) and `icons.LucideIcon`. Retag with `Tag`, not raw HTML.
  Recorded exceptions: the `<html>/<head>/<body>` shell in `layout.templ`,
  sanitized markdown through `templ.Raw` in the detail screen, and the JSON data
  scripts (`templ.JSONScript`: cart catalog, button preview classes).
- Spacing on the 8+4 scale inside blocks; colours only from tokens
  (`bg-card`, `text-muted-foreground`, ...), never hex.
- Use `Align: "stretch"` on stacks that hold cards or forms (the kit default is `start`).
- JS-only parts start `hidden` with `data-js-show`; no-JS notices carry `data-js-hide`.
- Fonts are self-hosted (Istok Web); no CDNs (CSP forbids them anyway).

## 6. Security model

- CSP `default-src 'self'` with a per-request nonce (no inline styles or
  handlers); `X-Frame-Options: DENY`, `nosniff`, referrer and permissions
  policies; HSTS when `SITE_ENV=production`.
- Cabinet POSTs require same origin (`Origin` / `Sec-Fetch-Site`); the session
  cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- Sign-in limit 5/min per client IP, in memory only (`X-Forwarded-For` trusted
  only from `SITE_TRUSTED_PROXIES`). Sign-out rotates the token key.
- Error logs carry the path and error only, never IPs or headers.

## 7. Recipes

**Add a field to a section** (e.g. `products.sku`):
1. New migration `internal/migrations/<unix>_products_sku.go` adding the field.
2. Add a `preset.Field{Name: "sku", Label: "field.sku", Kind: preset.KindText, Max: 64}` to the section.
3. Add `field.sku` to `ui/dict/en.json`. The cabinet form and save code are generated
   from the section fields. Show it on the site through `view.Detail`/`view.Card`.
4. `make generate && make verify`.

**Add a section to a preset**: add the `preset.Section` + migration for the
collection (copy `contentCollection`), dictionary keys `section.<name>.*`,
seed entries if useful, then run the smoke test for every preset.

**Add a block**: `ui/blocks/<name>.templ` with one `@c.Block` root, props type in
`ui/blocks/doc.go`, text through props (never literals), then `make generate`.

**Change colours or fonts**: `ui/styles/theme.css` / `fonts.css`, then `make css`.

**Change the contact button**: cabinet → Settings (admin; live preview) or
`site init --contact-url … --contact-label … --contact-variant … --contact-size … [--contact-new-window]`.
Still exactly one.

**Someone wants a contact form, analytics or logs**: not in this starter by
default. It changes what the site collects: get the owner's explicit decision,
update the privacy policy/agreements, flip the documented switch (PRIVACY.md),
and keep `scripts/privacy-check.sh` green (its opt-in markers exist for this).

## 8. Verify before every commit

```sh
make verify                     # gofmt, vet, test -race, govulncheck, templ diff, privacy check
make build && make run          # then click through: home, list, detail, cart, cabinet
```

Go tests cover all three presets (`internal/web/web_test.go`, `privacy_test.go`:
every page with the privacy assertions, admin/API hidden, browser-only cart with
exactly one contact, contact button settings incl. `noopener`, cabinet flows,
access log modes, sign-in rate limit). CI (`.github/workflows/ci.yml`) runs the same.
Dependabot alerts are on; there is no `dependabot.yml` on purpose (no update PRs).

## 9. Deploy checklist

See `deploy/README.md`. In short: `make verify && make build` → snapshot →
push the binary → restart (migrations run on start) → check `/healthz`, that `/_/`
and `/api/*` are 404 from outside, HSTS present, no `Set-Cookie` on `/`.
`SITE_ACCESS_LOG=off`, Caddy without access log, journald retention 7 days.
Back up `pb_data` with restic; a snapshot is not a backup. Never run
`site demo seed` on a server.

## 10. Git

Small commits on `main`, English messages, `make verify` green before pushing.

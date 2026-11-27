# Privacy

The site is built like a static site with an editor's cabinet. **It collects
nothing from visitors**, so it needs no cookie or consent banner. That is a
design rule, not a setting: no consent banner or component exists in this
repository, and none should be added. If a feature would need one, it does
not belong in this starter.

## What visitors get

| Rule | How it is enforced |
|---|---|
| No cookies on public pages | The only cookie is `site_session`, set when an editor or admin signs in to `/cabinet`. Tests: `assertPrivate` (`internal/web/web_test.go`) checks every public page for `Set-Cookie`. |
| No visitor data in the database | No collection stores visitor input (there is no contact form, no leads, no orders). Public routes are GET only; a test posts to every public path and expects an error. |
| Cart only in the browser | `app.js` keeps the cart in `sessionStorage` of the tab (memory when storage is blocked). Name, contact and note are typed into the order message in the browser and never sent. The buyer copies the message and sends it with the one contact button. |
| No third-party requests | Fonts, images, CSS and JS are served by the site; CSP is `default-src 'self'` with a per-request script nonce. Tests check that no public page references another host (plain `<a>` links excepted) and that `app.js` makes no network calls. |
| No analytics, trackers or embeds | None are shipped. Adding one is a legal change, not a code change (see below). |
| New-window links are safe | `target="_blank"` always comes with `rel="noopener noreferrer"` (contact button setting; tested). |

## Every place data could be written

| Place | What | Control | Default |
|---|---|---|---|
| PocketBase logs (`pb_data/auxiliary.db`, table `_logs`) | request logs: method, URL, status, user agent, referer; client IP only in `full` | `SITE_ACCESS_LOG=off\|anon\|full` (`internal/config`, applied on every start by `internal/privacy.ApplyLogSettings`) | **`off`**: `Logs.MaxDays=0`, PocketBase writes no logs at all |
| | | `anon`: 3 days, `LogIP=false`, `LogAuthId=false` | |
| | | `full`: 7 days, `LogIP=true` | |
| Site process output (stdout/stderr → journald) | start-up lines, `request failed: <path>: <error>`; never IPs or headers | code: `internal/web/web.go` (`fail`), `cmd/site/main.go` | on, no visitor data |
| journald | the lines above, plus Caddy's own runtime log if Caddy runs under systemd | `deploy/journald-site.conf` → `/etc/systemd/journald.conf.d/site.conf` | `MaxRetentionSec=7day`, `SystemMaxUse=200M` |
| Caddy access log | one line per request (IP, URL, user agent) | `log` directive in the site block of `deploy/Caddyfile.example` | **none**: the example has no `log` directive; an anonymising block is commented out |
| Caddy runtime log | errors; handler errors can include the client address | global `log default { exclude http.log.error }` in `deploy/Caddyfile.example` | handler error entries excluded |
| Cabinet sign-in limiter | client IP → attempt counter, in memory only, 1 minute | `internal/security/ratelimit.go` | in memory, never written |
| Backups (restic) | `pb_data/data.db` (content, cabinet accounts) and `pb_data/storage` (covers) | `deploy/README.md`, section 7 | `auxiliary.db` (logs) is not backed up |
| Hosting provider | network/firewall logs of the VPS or cloud | outside this repository | ask the provider; keep retention short |

The hosting layer can still see IP addresses (TCP connections, provider
firewall logs). Keep every such log short-lived and mention the provider in
the site's privacy notice.

## Turning anything on

Every switch above defaults to off. Turning one on (`SITE_ACCESS_LOG=anon` or
`full`, a Caddy `log` block, longer journald retention, an analytics script, a
form) is a deliberate decision that **requires updating the site's privacy
policy and, where needed, the agreements** (processor agreement with the
host, legal basis for IP logging) before deployment. Record the decision in
the deploy notes.

`scripts/privacy-check.sh` (run by `make verify` and CI) fails when:

- `deploy/Caddyfile.example` has an active `log` directive without a
  `# privacy-opt-in:` marker line directly above it;
- the default of `SITE_ACCESS_LOG` is not `off` (code, env example, unit);
- a consent/cookie banner component appears in templates or static files;
- the privacy tests fail (no cookies, no forms, no external references,
  no IPs in logs when off, `app.js` without network calls).

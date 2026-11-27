# Deploy

One binary, one SQLite data directory, Caddy in front. This guide uses an
[incus](https://linuxcontainers.org/incus/) container on a VPS; plain systemd on
a VM works the same way (skip the incus steps).

```
internet ── Caddy :443 (host) ── site :8090 (container, loopback or bridge)
                                   └─ /var/lib/site/pb_data (SQLite + uploads)
```

## Rules

- `/_/` (PocketBase admin) and `/api/*` are **never public**. Caddy answers 404,
  and the site answers 404 for any request with `X-Forwarded-For`/`Forwarded`
  headers or from a peer outside `SITE_ADMIN_ALLOW`. Open the admin only through
  an SSH tunnel (below).
- No secrets in git. The real env file lives in `/etc/site/site.env`.
- **Snapshot before every deploy.** A snapshot is not a backup: it lives on the
  same disk. Back up `pb_data` off the host with restic.
- `site demo seed` and `site dev` refuse to run with `SITE_ENV=production`.
- **Privacy defaults stay on** (see `PRIVACY.md`): `SITE_ACCESS_LOG=off` (the app
  writes no request logs), no Caddy access log, journald retention 7 days.
  Hosting access logs can still contain IP addresses; keep them short. Turning
  any log on requires updating the privacy policy and agreements first.

## 1. Build

```sh
make verify
make build              # bin/site, static, CGO_ENABLED=0
```

## 2. Container (incus)

```sh
incus launch images:debian/13 site
incus config set site limits.memory 512MiB
incus exec site -- useradd --system --home /var/lib/site --create-home --shell /usr/sbin/nologin site
incus exec site -- install -d -o root -g site -m 0750 /etc/site
incus file push bin/site site/usr/local/bin/site --mode 0755
incus file push deploy/site.service site/etc/systemd/system/site.service
incus file push deploy/site.env.example site/etc/site/site.env --mode 0640
incus exec site -- install -d /etc/systemd/journald.conf.d
incus file push deploy/journald-site.conf site/etc/systemd/journald.conf.d/site.conf
incus exec site -- systemctl restart systemd-journald
incus exec site -- chgrp site /etc/site/site.env
incus exec site -- editor /etc/site/site.env   # SITE_BASE_URL, SITE_TRUSTED_PROXIES
```

If Caddy runs on the host, the site must listen on the container address
instead of loopback: change `--http 127.0.0.1:8090` to `--http 0.0.0.0:8090` in
the unit, set `SITE_TRUSTED_PROXIES` to the bridge gateway (for example
`10.10.10.1/32`) and keep `SITE_ADMIN_ALLOW` at loopback. Restrict the port to the
bridge with the incus network ACL or nftables. Requests from Caddy always carry
`X-Forwarded-For`, so `/_/` stays 404 through the proxy.

## 3. First run

```sh
incus exec site -- su -s /bin/sh site -c 'set -a; . /etc/site/site.env; \
  site init --preset corporate --brand "Acme Studio" \
    --contact-url https://t.me/acme --contact-label "Write us in Telegram"'
incus exec site -- su -s /bin/sh site -c 'set -a; . /etc/site/site.env; \
  site superuser upsert root@example.com "<long random password>"'
incus exec site -- su -s /bin/sh site -c 'set -a; . /etc/site/site.env; \
  site user add owner@example.com --name Owner --role admin --password "<long random password>"'
incus exec site -- systemctl enable --now site
```

`site init` stores the preset, brand and the single contact channel in the
settings record. The contact URL must be `https://`, `mailto:` or `tel:`.

## 4. Caddy (host)

Copy `Caddyfile.example` into the host's Caddy config, set the domain and the
upstream (`127.0.0.1:8090`, or the container address), then `systemctl reload caddy`.
Check from outside:

```sh
curl -sI https://example.com/ | grep -i strict-transport   # HSTS present
curl -s -o /dev/null -w '%{http_code}\n' https://example.com/_/   # 404
curl -s -o /dev/null -w '%{http_code}\n' https://example.com/api/collections/users/records  # 404
curl -sI https://example.com/ | grep -ci set-cookie   # 0: public pages set no cookies
```

The example Caddyfile writes **no access log** and drops handler-error entries
(they can carry client addresses) from Caddy's runtime log. On the host,
install the same journald drop-in (`deploy/journald-site.conf`) so Caddy's
runtime log is kept for 7 days at most.

## 5. Admin through an SSH tunnel

```sh
# site on the host itself
ssh -L 8090:127.0.0.1:8090 user@host
# site in an incus container: forward to the container address
ssh -L 8090:<container-ip>:8090 user@host
```

Then open <http://127.0.0.1:8090/_/>. For the container case, add the host's
bridge address to `SITE_ADMIN_ALLOW` (tunnelled requests arrive from the host
without forwarding headers), or run `incus exec site -- site superuser ...` for
account work and skip the UI. The cabinet (`/cabinet`) is the normal place for
content and is public behind sign-in.

## 6. Every deploy

```sh
make verify && make build
incus snapshot create site pre-$(date +%Y%m%d-%H%M)     # before touching anything
incus file push bin/site site/usr/local/bin/site --mode 0755
incus exec site -- systemctl restart site                # migrations run on start
curl -fsS https://example.com/healthz
# rollback: incus snapshot restore site pre-YYYYMMDD-HHMM
```

## 7. Logs and IP addresses

| Switch | Default | Opt-in |
|---|---|---|
| `SITE_ACCESS_LOG` in `/etc/site/site.env` | `off`: PocketBase writes no logs | `anon` (3 days, no IPs) or `full` (7 days, with IPs) |
| Caddy `log` directive | none | uncomment the block in `Caddyfile.example` (IPs masked, rolled after 3 days), keep the `# privacy-opt-in:` marker |
| journald (`/etc/systemd/journald.conf.d/site.conf`) | 7 days, 200 MB | longer retention |

Any opt-in is a deliberate decision: update the privacy policy and, where
needed, the processor agreement with the host and the legal basis for IP
logging **before** switching it on, and note the change in your deploy notes.
`scripts/privacy-check.sh` fails CI when the repository defaults change.

## 8. Backups (restic)

A snapshot is not a backup. Back up `pb_data` to another machine or bucket:

```sh
# consistent copy first (SQLite online backup), then restic
incus exec site -- sqlite3 /var/lib/site/pb_data/data.db ".backup /var/lib/site/backup.db"
# auxiliary.db (logs) is not backed up on purpose
restic -r s3:https://s3.example.com/site-backups backup /var/lib/site/backup.db /var/lib/site/pb_data/storage
restic -r s3:https://s3.example.com/site-backups forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
```

Keep the restic password and bucket keys outside the repository (for example in
`/root/.config/restic/env`, mode 0600). Test a restore at least once.

## Checklist

- [ ] `make verify` passes, `bin/site` built from a clean tree
- [ ] `/etc/site/site.env`: `SITE_ENV=production`, https `SITE_BASE_URL`, no `SITE_DEMO_PASSWORD`
- [ ] superuser and cabinet admin have long unique passwords; demo data is not present
- [ ] settings: brand name and one real contact channel (button text, look, new window)
- [ ] snapshot taken; restic backup configured and a restore tested
- [ ] from outside: `/_/` and `/api/*` are 404, HSTS present, `/healthz` 200, no `Set-Cookie` on `/`
- [ ] `SITE_ACCESS_LOG=off`, Caddy without access log, journald drop-in installed (or an opt-in recorded with updated legal docs)

#!/usr/bin/env bash
# Privacy-by-design gate (PRIVACY.md). Run by make verify and CI.
set -euo pipefail
cd "$(dirname "$0")/.."
fail() { echo "privacy-check: $*" >&2; exit 1; }

# 1. Caddy: an active `log` directive needs the opt-in marker on the line above.
awk '
  /^[[:space:]]*#/ { prev = $0; next }
  /^[[:space:]]*log([[:space:]]|\{|$)/ {
    if (prev !~ /#[[:space:]]*privacy-opt-in:/ && !global) { print FILENAME ":" NR ": log directive without # privacy-opt-in: marker"; bad = 1 }
  }
  { if ($0 ~ /^\{/) global = 1; if ($0 ~ /^\}/) global = 0; prev = $0 }
  END { exit bad }
' deploy/Caddyfile.example || fail "Caddyfile.example enables an access log without the opt-in marker"

# 2. SITE_ACCESS_LOG defaults to off everywhere.
grep -Eq '^const DefaultAccessLog = AccessLogOff$' internal/config/config.go || fail "DefaultAccessLog is not AccessLogOff"
grep -Eq '^SITE_ACCESS_LOG=off$' deploy/site.env.example || fail "deploy/site.env.example must set SITE_ACCESS_LOG=off"
grep -Eq '^Environment=SITE_ACCESS_LOG=off$' deploy/site.service || fail "deploy/site.service must set SITE_ACCESS_LOG=off"
if grep -Eq '^MaxRetentionSec=([0-9]+)day' deploy/journald-site.conf; then
  days=$(sed -nE 's/^MaxRetentionSec=([0-9]+)day.*/\1/p' deploy/journald-site.conf)
  [ "$days" -le 14 ] || fail "journald retention longer than 14 days"
else
  fail "deploy/journald-site.conf must set MaxRetentionSec=<n>day"
fi

# 3. No consent banner, analytics or third-party code in what the site serves.
code="internal/web/screens ui/blocks ui/styles internal/web/static"
if grep -rniE 'consent|cookie-?banner|gdpr-banner' $code --include='*.templ' --include='*.js' --include='*.css' >/dev/null; then
  fail "consent/cookie banner found; the site must not need one"
fi
if grep -rniE 'googletagmanager|google-analytics|gtag\(|plausible|matomo|yandex\.ru/metrika|mc\.yandex|facebook\.net|hotjar|segment\.(io|com)|fonts\.googleapis|cdn\.jsdelivr|unpkg\.com|cdnjs' $code internal/web/*.go >/dev/null; then
  fail "analytics, tracker or CDN reference found"
fi

# 4. Behaviour: no cookies, no forms, no external references, no IPs in logs when off.
go test -count=1 -run 'TestPresetsSmoke|TestShopCartIsBrowserOnly|TestContactButtonSettings|TestAccessLogModes|TestDefaultsArePrivate' ./internal/web/ >/dev/null \
  || fail "privacy tests failed (go test ./internal/web -run 'Presets|Cart|Contact|AccessLog|Defaults' -v)"

echo "privacy-check: ok"

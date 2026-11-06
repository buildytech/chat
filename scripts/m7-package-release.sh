#!/usr/bin/env bash
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="${RELEASE_OUT:-/workspace/var/phpingineer/buildy-vps/release/$STAMP}"
mkdir -p "$OUT/bin" "$OUT/plugin" "$OUT/app" "$OUT/systemd" "$OUT/env" "$OUT/docs"

echo "Building linux amd64 Session binary..."
( cd "$REPO/services/context-serve" && CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o "$OUT/bin/buildy-session-serve" . )

echo "Building chat-web SPA..."
( cd "$REPO/apps/chat-web" && npm run build )
# Copy build artifacts
if [[ -d "$REPO/apps/chat-web/build" ]]; then
  cp -a "$REPO/apps/chat-web/build/." "$OUT/app/"
elif [[ -d "$REPO/apps/chat-web/.svelte-kit/output/client" ]]; then
  cp -a "$REPO/apps/chat-web/.svelte-kit/output/client/." "$OUT/app/"
else
  echo "WARN: chat-web build output not found; packing source marker"
  echo "missing-build" > "$OUT/app/MISSING_BUILD.txt"
fi

echo "Packing WordPress plugin..."
rsync -a --exclude node_modules --exclude tests/wp-stubs.php \
  "$REPO/adapters/wordpress/" "$OUT/plugin/buildytech-si-chat/"
mkdir -p "$OUT/plugin/buildytech-si-chat/app"
if [[ -d "$OUT/app" && ! -f "$OUT/app/MISSING_BUILD.txt" ]]; then
  cp -a "$OUT/app/." "$OUT/plugin/buildytech-si-chat/app/" || true
fi

# Pin node deps list for OPS (package-lock hashes)
if [[ -f "$REPO/package-lock.json" ]]; then
  cp "$REPO/package-lock.json" "$OUT/docs/package-lock.json"
fi
if [[ -f "$REPO/apps/chat-web/package.json" ]]; then
  cp "$REPO/apps/chat-web/package.json" "$OUT/docs/chat-web.package.json"
fi

# systemd templates (no secrets)
cat > "$OUT/systemd/buildy-session.service" << 'UNIT'
[Unit]
Description=BuildY Session HTTP (page+session store)
After=network.target

[Service]
Type=simple
User=buildy
WorkingDirectory=/opt/buildy/session
EnvironmentFile=-/etc/buildy/session.env
ExecStart=/opt/buildy/session/bin/buildy-session-serve
Restart=on-failure
RestartSec=2
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/buildy/session
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

cat > "$OUT/env/session.env.example" << 'ENV'
CONTEXT_SERVE_ADDR=127.0.0.1:18090
PAGE_STORE_PATH=/var/lib/buildy/session/pages.sqlite
BUILDY_BASIC_AUTH_USER=
BUILDY_BASIC_AUTH_PASS=
BUILDY_LIVE_MODEL=0
CONTEXT_RUNTIME_URL=http://127.0.0.1:18085
# Never commit real secrets. OPS fills on VPS.
ENV

cat > "$OUT/env/wordpress-plugin.env.example" << 'ENV'
# Stored in WP option buildytech_si_chat_settings (server-side only)
# session_base_url=http://127.0.0.1:18090
# basic_auth_user=...
# basic_auth_pass=...
# bound_session_id=sess-...
# bound_page_id=page-...
# allow_public_publish=false
ENV

cat > "$OUT/docs/DEPLOY.md" << 'DOC'
# BuildY chat.buildy.tw — release deploy notes (OPS)

Coding ships this artifact; OPS wires Incus + Caddy. Do not build on VPS.

## Minimum runtimes
- buildy-session-serve: linux/amd64, glibc, CGO sqlite
- Node: for Creator SPA origin and optional Latte emit (pinned via package-lock)
- PHP 8.2+ with curl for WordPress plugin
- Latte 3 via plugin composer or shared vendor autoload

## Topology
- Caddy terminates TLS for chat.buildy.tw
- Prefer same-origin: Caddy → WordPress (plugin REST proxy) → Session on 127.0.0.1:18090
- Session binds loopback only; BasicAuth required on VPS
- Context Runtime on 127.0.0.1:18085 (separate unit)
- No Docker / no on-VPS builds

## Plugin
1. Copy `plugin/buildytech-si-chat` → `wp-content/plugins/`
2. Activate; set Settings (Session URL, BasicAuth, bound ids)
3. Agent page created as draft with unique slug
4. Public publish remains 403

## Verify
- GET /wp-json/buildytech/v1/health (auth'd WP user)
- Preserved or acceptance session reload
- Latte render same revision endpoint
DOC

# hashes
( cd "$OUT" && find . -type f ! -name SHA256SUMS | sort | xargs sha256sum > SHA256SUMS )
# node/npm versions
{
  echo "node $(node -v 2>/dev/null || echo missing)"
  echo "npm $(npm -v 2>/dev/null || echo missing)"
  echo "go $(go env GOVERSION 2>/dev/null || echo missing)"
  echo "php $(/workspace/bin/php -v | head -1)"
  echo "builtAt $(date -Iseconds)"
  echo "git $(cd "$REPO" && git rev-parse HEAD)"
} > "$OUT/docs/build-info.txt"

echo "RELEASE_OUT=$OUT"
ls -la "$OUT/bin" "$OUT/plugin" | head
wc -l "$OUT/SHA256SUMS"

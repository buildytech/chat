#!/usr/bin/env bash
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT_ROOT="${RELEASE_OUT:-/workspace/var/phpingineer/buildy-vps/release/$STAMP}"
PLUGIN_SRC="$REPO/adapters/wordpress"
STAGE="$OUT_ROOT/zip-stage/buildytech-si-chat"
mkdir -p "$STAGE" "$OUT_ROOT/bin" "$OUT_ROOT/docs" "$OUT_ROOT/systemd" "$OUT_ROOT/env"

echo "== SPA build (Kit static) + WP embed (router-free mount) =="
( cd "$REPO/apps/chat-web" && npm run build && npm run build:wp-embed )

echo "== linux Session binary =="
( cd "$REPO/services/context-serve" && CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o "$OUT_ROOT/bin/buildy-session-serve" . )

echo "== Latte composer in plugin (for optional server render) =="
if [[ ! -f "$PLUGIN_SRC/vendor/autoload.php" ]]; then
  ( cd "$PLUGIN_SRC" && /workspace/bin/composer install --no-dev --prefer-dist --no-interaction 2>&1 | tail -20 )
fi

echo "== Bundle latteFromPage for ZIP (no chat-web source required at runtime) =="
if command -v npx >/dev/null; then
  ( cd "$REPO/apps/chat-web" && npx --yes esbuild src/lib/page-store/latte.ts \
      --bundle --platform=node --format=esm \
      --outfile="$PLUGIN_SRC/bin/latte-from-page.mjs" ) || echo "WARN: esbuild latte bundle failed"
  # also pack pack.ts helpers used by emit
  ( cd "$REPO/apps/chat-web" && npx --yes esbuild src/lib/page-store/pack.ts \
      --bundle --platform=node --format=esm \
      --outfile="$PLUGIN_SRC/bin/pack-from-page.mjs" ) || true
fi

# Rewrite emit to prefer bundled modules
cat > "$PLUGIN_SRC/bin/emit-latte.mjs" << 'EMIT'
#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const pageJsonPath = arg("--page-json");
const outDir = arg("--out");
const phpBin = arg("--php", "php");
const latteAutoload = arg("--latte-autoload");
if (!pageJsonPath || !outDir || !latteAutoload) {
  console.error("usage: emit-latte.mjs --page-json P --out O --php BIN --latte-autoload A");
  process.exit(2);
}
const bundledLatte = join(__dirname, "latte-from-page.mjs");
const bundledPack = join(__dirname, "pack-from-page.mjs");
const repoLatte = resolve(__dirname, "../../../apps/chat-web/src/lib/page-store/latte.ts");
const repoPack = resolve(__dirname, "../../../apps/chat-web/src/lib/page-store/pack.ts");
const repoRuntime = resolve(__dirname, "../../../apps/chat-web/src/lib/page-store/codeport-runtime.ts");
const repoMain = resolve(__dirname, "../../../apps/chat-web/codeport-pack/Main/page.latte");
const pluginMain = resolve(__dirname, "../codeport/Main/page.latte");

let latteFromPage, packFilesFromPage, COIMPORT_PACK_FILES;
if (existsSync(bundledLatte) && existsSync(bundledPack)) {
  ({ latteFromPage } = await import(pathToFileURL(bundledLatte).href));
  ({ packFilesFromPage } = await import(pathToFileURL(bundledPack).href));
  COIMPORT_PACK_FILES = [{ path: "Main/page.latte", content: readFileSync(existsSync(pluginMain)?pluginMain:repoMain, "utf8") }];
} else {
  ({ latteFromPage } = await import(pathToFileURL(repoLatte).href));
  ({ packFilesFromPage } = await import(pathToFileURL(repoPack).href));
  ({ COIMPORT_PACK_FILES } = await import(pathToFileURL(repoRuntime).href));
}

const envelope = JSON.parse(readFileSync(pageJsonPath, "utf8"));
const dto = envelope.page;
const revision = envelope.revision ?? 0;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
mkdirSync(join(outDir, "pack"), { recursive: true });
mkdirSync(join(outDir, "tmp"), { recursive: true });
mkdirSync(join(outDir, "dist"), { recursive: true });
const mainPath = existsSync(pluginMain) ? pluginMain : repoMain;
const diskMain = readFileSync(mainPath, "utf8");
const exactPageLatte = latteFromPage(dto, null);
const files = packFilesFromPage(dto, null);
for (const f of files) {
  const dest = join(outDir, "pack", f.path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, f.content);
}
function flattenBlocks(blocks, out = {}) {
  for (const b of blocks || []) {
    out[b.id] = { id: b.id, kind: b.kind, title: b.title ?? "", summary: b.summary ?? "", copy: b.copy ?? {}, children: b.children ?? [] };
    if (b.children?.length) flattenBlocks(b.children, out);
  }
  return out;
}
const pageObject = {
  id: dto.id, slug: dto.slug, status: dto.status, title: dto.title, locale: dto.locale,
  seo: dto.seo ?? {}, createdAt: dto.createdAt, updatedAt: dto.updatedAt, layout: dto.layout,
  blocks: flattenBlocks(dto.layout?.blocks || []),
};
writeFileSync(join(outDir, "page-object.json"), JSON.stringify(pageObject) + "\n");
const renderPhp = `<?php
declare(strict_types=1);
require ${JSON.stringify(latteAutoload)};
$out = ${JSON.stringify(outDir)};
$raw = json_decode(file_get_contents($out . '/page-object.json'), true, 512, JSON_THROW_ON_ERROR);
$page = new stdClass();
foreach (['id','slug','status','title','locale','createdAt','updatedAt'] as $k) { $page->$k = $raw[$k] ?? null; }
$page->seo = $raw['seo'] ?? [];
$page->blocks = $raw['blocks'];
$page->layout = $raw['layout'];
$latte = new Latte\\Engine();
$latte->setTempDirectory($out . '/tmp');
$latte->setLoader(new Latte\\Loaders\\FileLoader($out . '/pack'));
$html = $latte->renderToString('page.latte', ['page' => $page]);
$htmlPath = $out . '/dist/' . $page->id . '-rev' . ${JSON.stringify(String(revision))} . '.html';
file_put_contents($htmlPath, $html);
$meta = [
  'ok' => true, 'pageId' => $page->id, 'slug' => $page->slug, 'revision' => ${Number(revision)},
  'draftId' => $page->id, 'status' => $page->status, 'htmlPath' => $htmlPath,
  'htmlBytes' => strlen($html), 'htmlSha256' => hash('sha256', $html),
  'pageLatteSha256' => ${JSON.stringify(sha256(exactPageLatte))},
  'emitter' => 'latteFromPage', 'layout' => 'Main/page.latte',
];
file_put_contents($out . '/render-meta.json', json_encode($meta, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE) . "\\n");
echo json_encode($meta, JSON_UNESCAPED_UNICODE), "\\n";
`;
writeFileSync(join(outDir, "render.php"), renderPhp);
execFileSync(phpBin, [join(outDir, "render.php")], { stdio: "inherit" });
EMIT
chmod +x "$PLUGIN_SRC/bin/emit-latte.mjs"

echo "== Stage plugin tree =="
rm -rf "$STAGE"
mkdir -p "$STAGE"
shopt -s dotglob nullglob
for item in "$PLUGIN_SRC"/*; do
  base=$(basename "$item")
  case "$base" in
    node_modules|src|package.json|tests) continue ;;
  esac
  cp -a "$item" "$STAGE/"
done
shopt -u dotglob nullglob
# Ensure SPA assets
mkdir -p "$STAGE/app"
if [[ -d "$REPO/apps/chat-web/build" ]]; then
  cp -a "$REPO/apps/chat-web/build/." "$STAGE/app/"
fi
# Router-free WP embed (preferred; stops Kit reload loops on admin.php?page=…)
if [[ -d "$REPO/apps/chat-web/build-wp" ]]; then
  cp -a "$REPO/apps/chat-web/build-wp/." "$STAGE/app/"
fi
# Strip any accidental secrets
find "$STAGE" -name '*.env' -delete
# Ensure no default site_token in shipped PHP defaults (already empty)

cat > "$STAGE/readme.txt" << 'READ'
=== BuildYtech SI Chat ===
Contributors: buildytech
Requires at least: 6.4
Requires PHP: 8.2
Stable tag: 0.1.2
License: Apache-2.0

CMS-agnostic Creator chat adapter for WordPress (draft-only).

== Description ==
Embeds the Creator chat SPA in wp-admin and proxies Page/Session APIs to a BuildY Session backend
using a per-site server-side token. No BuildY user login. No public publish. Model credentials stay on the VPS.

This plugin does NOT require WP FastY / Fasty theme. Optional Latte HTML render uses latte/latte (bundled in vendor/)
and Node only for the latte-render admin endpoint. Preview uses the bundled Svelte SPA.

== Installation ==
1. Upload buildytech-si-chat.zip via Plugins → Add New → Upload, or unzip into wp-content/plugins/buildytech-si-chat/
2. Activate.
3. SI Chat → Settings:
   - Session base URL (loopback or https host on allowlist, default includes chat.buildy.tw)
   - Site ID (auto from site URL if empty) — unique per WP install / niche
   - Site token — paste the token OPS issued for this site (never commit; not shipped in ZIP)
   - Optional BasicAuth if the Session unit still uses it for transport
4. OPS must register the same site_id:token in BUILDY_SITE_TOKENS on the Session host.
5. Bind preserved or new session/page ids as needed. Publish remains blocked (draft only).

== Requirements ==
* WordPress 6.4+, PHP 8.2+ with curl
* BuildY Session reachable from the WP server (same-origin proxy preferred)
* Per-site token (server-side). Model API keys are NOT configured in the plugin.

== Privacy / Security ==
* Capability edit_pages / manage_options
* REST nonces
* Site token and BasicAuth never localized to JavaScript
* Backend URL restricted to loopback or https allowlisted hosts (no open proxy)
READ

cat > "$STAGE/INSTALL.md" << 'INST'
# Install BuildYtech SI Chat (local multi-site / niches)

## What you get
- Plugin folder `buildytech-si-chat/` with compiled SPA under `app/`
- Optional `vendor/` (Latte 3) for draft HTML render
- **No credentials** in the ZIP

## Manual config (remaining — intentional)
1. **OPS (once per VPS):** set `BUILDY_SITE_TOKENS=site-a:TOKEN_A,site-b:TOKEN_B` (and optional BasicAuth) on Session systemd unit. Model secrets stay only on VPS env — never in WP.
2. **Each WP site:** paste that site's token into SI Chat → Settings → Site token. Site ID auto-derives from `home_url` (override if you want a readable id).
3. Session URL: `http://127.0.0.1:18090` for local sidecar, or `https://chat.buildy.tw` only if allowlisted and proxied safely.

## Isolation
Each WP install has its own `site_id`. Session stores rows tagged with that id; lists/gets never cross sites (including multiple localhost sites).

## Not claimed
- Universal theme support / automatic Fasty or WP FastY integration
- Public publish / storefront checkout
- Separate BuildY end-user accounts (Authfly deferred)

## Tradeoffs
- Site token ≠ model spend gate alone: WP `edit_pages` + site token + (optional) BasicAuth required. Anonymous paid calls remain closed.
- Auto-provision of tokens was rejected to avoid an unauthenticated open API; OPS issues tokens.
- Latte endpoint needs Node on the WP host **or** skip Latte and use SPA Preview/Code only.
INST

# ZIP with top-level directory; Python stdlib avoids a system zip dependency.
ZIP="$OUT_ROOT/buildytech-si-chat-$STAMP.zip"
python3 - "$OUT_ROOT/zip-stage" "$ZIP" <<'PYZIP'
from pathlib import Path
import sys, zipfile
root = Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted((root / 'buildytech-si-chat').rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(root))
PYZIP

# Release docs + systemd (from earlier script patterns)
cp "$REPO/deploy/systemd/"* "$OUT_ROOT/systemd/" 2>/dev/null || true
cat > "$OUT_ROOT/systemd/buildy-session.service" << 'UNIT'
[Unit]
Description=BuildY Session HTTP
After=network.target
[Service]
Type=simple
User=buildy
WorkingDirectory=/opt/buildy/session
EnvironmentFile=-/etc/buildy/session.env
ExecStart=/opt/buildy/session/bin/buildy-session-serve
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/buildy/session
PrivateTmp=true
[Install]
WantedBy=multi-user.target
UNIT
cat > "$OUT_ROOT/env/session.env.example" << 'ENV'
CONTEXT_SERVE_ADDR=127.0.0.1:18090
PAGE_STORE_PATH=/var/lib/buildy/session/pages.sqlite
BUILDY_BASIC_AUTH_USER=
BUILDY_BASIC_AUTH_PASS=
BUILDY_SITE_TOKENS=site-example:replace-me
BUILDY_LIVE_MODEL=0
CONTEXT_RUNTIME_URL=http://127.0.0.1:18085
ENV

( cd "$OUT_ROOT" && find . -type f ! -name SHA256SUMS | sort | xargs sha256sum > SHA256SUMS )
{
  echo "zip $(basename "$ZIP")"
  echo "zipSha256 $(sha256sum "$ZIP" | awk '{print $1}')"
  echo "node $(node -v)"
  echo "go $(go env GOVERSION)"
  echo "php $(/workspace/bin/php -v | head -1)"
  echo "git $(cd "$REPO" && git rev-parse HEAD)"
  echo "builtAt $(date -Iseconds)"
} | tee "$OUT_ROOT/docs/build-info.txt"

echo "PLUGIN_ZIP=$ZIP"
echo "RELEASE_OUT=$OUT_ROOT"

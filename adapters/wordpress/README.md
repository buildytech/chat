# adapters/wordpress — BuildYtech SI Chat

CMS-agnostic Creator chat WordPress adapter (draft-only).

## Installable ZIP

Built by `scripts/m7-package-plugin-zip.sh` →  
`/workspace/var/phpingineer/buildy-vps/release/latest/buildytech-si-chat.zip`

Top-level directory: `buildytech-si-chat/` with plugin header, compiled SPA (`app/`), Latte vendor, INSTALL.md. **No credentials in ZIP.**

## Security model (t138u)

- WP capability `edit_pages` / `manage_options` — no separate BuildY login / Authfly.
- One **site_id** (auto from `home_url`) + **site_token** (server-side option only).
- Session validates `X-BuildY-Site-Id` + `X-BuildY-Site-Token` when `BUILDY_SITE_TOKENS` is set.
- Session URL allowlist: loopback always; non-loopback https hosts only (default includes `chat.buildy.tw`).
- Model secrets stay on VPS — never in the plugin. Site token does **not** open an anonymous paid endpoint.
- Public publish returns 403.

## Not claimed

Does **not** require WP FastY / Fasty theme. Preview is the bundled Svelte SPA. Latte HTML is optional (vendor + Node emit). Visual Builder remains untouched.

## Dev layout

See `includes/`, `bin/emit-latte.mjs`, `tests/plugin-http-integration.php`.

## WP admin mount (0.1.1+)

Creator loads via **router-free** `app/wp-embed.js` (`svelte` `mount` of ChatApp).
SvelteKit `kit.start` is **not** used on `admin.php?page=buildytech-si-chat` (avoids full-page reload loops when Kit owns history/URL).
Asset and REST URLs are host-relative so reverse proxies / ngrok work.
Deactivate does not wipe options or draft pages.

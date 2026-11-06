# adapters/wordpress

Thin WordPress plugin that **embeds the Svelte chat-web bundle** and speaks **PagePort REST**.

chat-web stays CMS-agnostic: no WordPress PHP imports inside `apps/chat-web`.

## Status: stub

- `buildytech-si-chat.php` — placeholder admin page (`#buildytech-si-chat-root`).
- `src/client.ts` — TypeScript client for `/buildytech/v1/pages*` (not served yet).

## Planned embed

1. `npm run build` in `apps/chat-web` (adapter-static, `200.html` fallback).
2. Plugin copies `build/` into `wp-content/plugins/buildytech-si-chat/app/`.
3. Admin enqueue of the SPA; `paths.base` set to the plugin URL.
4. REST routes implement `CatalogPort` / `PagePort` / `PublishPort` / `PreviewPort` as ordinary `page` + unique slug.

No checkout, no fabricated commerce fields.

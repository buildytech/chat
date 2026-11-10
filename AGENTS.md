# AGENTS.md — buildytech/chat

Browser-first Creator SPA (`npm` / Svelte 5). Chat + pages persist in this browser; live Grok uses protected `/runtime`. This repository is **not** a WordPress, ModulY, or manager runtime. Product hosts (WordPress builder page, Browser, Desktop Wails3) are sequenced in [ADR-0007](.project/adr/0007-one-buildy-three-hosts.md); finish Browser here first.

UI8Kit rules live with the contract. Copied here from [`github.com/ui8kit/contract`](https://github.com/ui8kit/contract) (`.cursor/rules`, `.cursor/skills`). Reference implementation: `codegen-x/ui8kit`. Shared provider / catalog codegen is **planned**, not wired in this repo.

## Owner delivery rules

- Push verified work to **`main`** with a normal fast-forward-safe push.
- **Do not open a pull request.** PRs permanently pollute this repo's history.
- Commit author: `Grok Bot <grokbot@users.noreply.github.com>` via `git -c user.name=… -c user.email=…`.
- No force / reset / amend of published history.
- Do not edit other repositories (wp-fasty, wpmodules, local-wp, …).

## Start

```sh
npm install
npm run dev          # http://127.0.0.1:5173 — Browser SPA (chats + pages in this browser)
npm test             # page-contract + unit tests (includes WP-runtime guard)
npm run check        # svelte-check
npm run build        # static SPA
npm run verify       # test + check + build
```

ChatCore saves chats and per-session applied/candidate pages in the browser. That persistence is not live Grok. Preview is a Svelte renderer of the Page DTO; Code is generated Svelte UI8Kit source, not a compiler and not Latte.

`services/context-serve` is a retired CI placeholder, not a Session HTTP product. Default `npm run dev` does not require it.

Optional protected xAI runtime (`XAI_API_KEY` server-only): `npm run start --workspace=@buildytech/xai-runtime` on `127.0.0.1:18100`. Vite proxies `/runtime`. Chat selector sends one of the five verified text model ids. Non-loopback bind is fail-closed without Basic Auth. Vercel staging uses root `middleware.js` (ESM, `"type": "module"`) + bundled `api/runtime/v1/{status,run}.ts` (Node via `engines.node` `22.x`; see `docs/deploy-xai.md`). Do not open a Vercel project until Basic Auth env is set.

## UI8Kit

- Rules: `.cursor/rules/00-ui8kit-core.mdc` … `05-checks-baselines.mdc`.
- Skills: `.cursor/skills/ui8kit-new-block`, `ui8kit-rule-checks`, `ui8kit-spacing-ui8px`.
- Single source of UI ([ADR 0008](.project/adr/0008-registry-single-source-of-ui.md)): `registry/svelte` is the literal `npx ui8kit init` + `add --all` output (do not hand-edit; `npm run registry:snapshot`, `npm run registry:check`). App UI lives in `apps/chat-web/src/app` and imports only `$registry/...` components with `tag` retag; `src/lib` is logic only (no `.svelte`). Blocks without a registry item render the "Not in the registry" stub.
- Props of registry blocks follow the pinned published schemas `registry/props.v0.json` ([ADR 0010](.project/adr/0010-props-schemas-program-gate.md)): the program validates the merged props (variant preset + page content + schema defaults) with Ajv 2020 strict in `packages/builder-core/src/catalog/props-gate.ts`; fail-closed until that module is imported (tests use `--import`, the browser loads it lazily). Do not add icon lists, synonyms or hand-written field hints; read them from the schema (`props-schema.ts`).
- Chat modes ([ADR 0011](.project/adr/0011-ask-build-modes-shared-agent-tools.md)): the author picks Ask or Build in the composer (stored per chat); never infer the mode from words. Ask sends only read-only tools and never creates a proposal; Build uses `tool_choice: auto` (text-only answers create no proposal). Tool definitions live only in `packages/builder-core/src/agent/agent-tools.v1.json`; do not define tools inline in the runtime.
- Preview: Settings "Hide service labels in Preview" (`buildy:v1:preview.hideServiceLabels`) hides chips, notes and per-block labels; Apply / Discard stay. "Open in new window" opens `/preview?session=<id>`: the chat's page (pending, else applied) with registry blocks and the registry CSS only, no chat UI, no labels, theme from the chat. That route never writes chat or page data (its first storage read may run the one-time buildy:v1 key migration).
- Catalog ([ADR 0012](.project/adr/0012-unified-catalog-snapshot.md)): pins only in `catalog/snapshot.config.json`; `npm run snapshot` (network, ~1 min) writes `catalog/stock-registry.v0.json`, `coverage.json`, `snapshot.lock.json` and the derived `snapshot.json` / `search-index.json`; `npm run snapshot:check` is offline. Never edit those by hand; BuildY policy (owner filters, Page DTO kind map, page size, search facets) lives only in `catalog/policy.v0.json` (`npm run snapshot:derive` after an edit). Enrich catalog data in codegen-x / the registry, not here. Stock blocks render by the screen's composition ([ADR 0013](.project/adr/0013-stock-blocks-render-by-composition.md)): `pageKindOfBlock` names the Page DTO slot shape, `catalogBlock` the block that renders; a screen is supported only when every block renders.
- Build inspector ([ADR 0014](.project/adr/0014-build-inspector.md)): preview blocks carry `data-block-id` (preview DOM only, never in exported code); hover / selection chrome is drawn by the chat over the frame (`CanvasOverlay`), never inside the page, and is absent in clean mode and `/preview`. Fields come only from the pinned props schemas (`propsFieldTree`, `organismFor` origins) with registry widgets; a field is editable only when it maps to a page-spec field. Writes go through `inspectorSetField` / `inspectorOp` (builder-core): `parsePageSpec` + props gate, fail closed, rejections show pointer and allowed values. Typing in one field is one undo step; variant / reset / move / duplicate / remove are one step each through page-patch gates. Do not add a field list or hints by hand.
- Session standard ([ADR 0015](.project/adr/0015-session-standard-buildy-v1.md), schema `https://schema.buildy.tw/session.schema.json`, vendored in `packages/page-contract/schema/session.schema.json`, entry `@buildytech/page-contract/session`): every browser value lives under `buildy:v1:*` (`lib/browser/storage-v1.ts`; legacy keys only there, moved once). Read and write storage only through `storage-v1.ts` / `persist.ts`; never call `localStorage` directly. Stored chats and page records are schema-checked at load; failures go to `buildy:v1:quarantine`, never dropped. Revisions: one per committed change (`page-store/revision.ts`), coalesced typing = one revision = one undo step, unchanged value = no-op; `session.pageRevision` and `history` follow `onPageRevision`.
- Skins ([ADR 0016](.project/adr/0016-skins-registry-theme-items.md)): registry items `theme-<skin>` (`npx ui8kit add theme-<skin>`), listed by `registrySkins()`; the chat's skin is session `skin`, switched in the preview header (`getChatSkin` / `setChatSkin`), applied to the preview document only (`lib/theme/skins.ts`), exported 1:1 with the CLI install (`packZipFiles(page, read, { skin })`). Settings has Export / Import of the session file and the Quarantine viewer (`app/SettingsSessionFile.svelte`).
- Layout ([ADR 0017](.project/adr/0017-ide-layout-resizable-panes.md)): compact IDE, nav | chat | preview | inspector (Layers over Properties in one column). Pane sizes and collapsed states live only in `lib/creator-layout.svelte.ts` (rules in `lib/layout/prefs.ts`, storage `buildy:v1:prefs` through `lib/layout/prefs-store.ts`, session `prefs.layout`); resize with `PaneSplitter.svelte` (role=separator, aria-valuenow/min/max, aria-controls) until the registry primitive (chaosbun#150) lands. Shortcuts Ctrl+B / Ctrl+I / Ctrl+\ (`lib/layout/shortcuts.ts`). Density: h-10 bars, sm controls, text-xs lists, 8px layout steps, 4px only inside controls; runtime sizes as inline style, never arbitrary classes.
- Build self-correction ([ADR 0018](.project/adr/0018-build-self-correction.md)): `search_catalog` relaxes facets (`relaxed`) and returns `facets` (counts, `browse: true`) instead of a dead end; `propose_layout` rejections use the caller's `blocks[i]` path with `fix` (allowed variants); the same block error twice or a budget spent on a rejected page accepts the page without that block's choice (`repairProposeArgs`, said in warnings); replies carry `budget`. The Stock search box uses the catalog text index. No word lists.
- Portable session (browser console or tests): `window.buildy.export()` returns the buildy:v1 file (`export({ download: true })` also saves it); `await window.buildy.import(fileOrJson)` validates (schema + program checks) and loads it, returning `{ ok, added, replaced, selected }` or `{ ok: false, code, issues }`. Replaced chats are quarantined first. Lab BuildY opens the same file. No credential ever enters a session.
- Brands live in CodeGen-X as database records (badge + filter), not as per-brand kits or author namespaces ([ADR 0009](.project/adr/0009-brands-in-codegen-x-single-registry.md)). The published registry stays one cleaned `@ui8kit` tree; do not hard-code author URLs.
- This repo does **not** vendor `packages/tooling` / `ui-gates`. Applicable gates here are `svelte-check`, `npm test`, `npm run build`. Do not grow UI8Kit baselines.

Svelte 5: runes (`$state` / `$derived` / `$props`). Logic-only ChatCore lives in `.svelte.ts` modules.

## Do not

- Reintroduce WordPress adapters, `X-WP-Nonce`, `wp-json`, `wp-admin` embed, plugin ZIP deploy scripts.
- Implement Browser MVP, BYOK, paid model calls, telemetry, proxies-as-product, or Page schema rewrites in a cleanup.
- Delete Page DTO, ports, mock PageStore, or CreatorShell because a WP adapter used to implement them.
- Treat domain status `published` as WordPress-specific.

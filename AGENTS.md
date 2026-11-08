# AGENTS.md — buildytech/chat

Browser-first Creator SPA. Cleanup baseline: mock ChatCore, UI8Kit paint, Page DTO/ports. This is **not** a WordPress, ModulY, or manager product.

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
npm run dev          # http://127.0.0.1:5173 — mock localStorage ChatCore
npm test             # page-contract + unit tests (includes WP-runtime guard)
npm run check        # svelte-check
npm run build        # static SPA
npm run verify       # test + check + build
```

Optional, non-default Session HTTP: run `services/context-serve` and open `/?live=1`. Default `npm run dev` must not require it.

Optional protected xAI runtime (`XAI_API_KEY` server-only): `npm run start --workspace=@buildytech/xai-runtime` on `127.0.0.1:18100`. Vite proxies `/runtime`. Chat selector sends one of the five verified text model ids. Non-loopback bind is fail-closed without Basic Auth. See `docs/xai-grok.md` and `docs/deploy-xai.md`.

## UI8Kit

- Rules: `.cursor/rules/00-ui8kit-core.mdc` … `05-checks-baselines.mdc`.
- Skills: `.cursor/skills/ui8kit-new-block`, `ui8kit-rule-checks`, `ui8kit-spacing-ui8px`.
- App composition: primitives in `apps/chat-web/src/ui` (generated kit; do not hand-patch). Screens in `src/lib/screens` use `tag` retag.
- This repo does **not** vendor `packages/tooling` / `ui-gates`. Applicable gates here are `svelte-check`, `npm test`, `npm run build`. Do not grow UI8Kit baselines.

Svelte 5: runes (`$state` / `$derived` / `$props`). Logic-only ChatCore lives in `.svelte.ts` modules.

## Do not

- Reintroduce WordPress adapters, `X-WP-Nonce`, `wp-json`, `wp-admin` embed, plugin ZIP deploy scripts.
- Implement Browser MVP, BYOK, paid model calls, telemetry, proxies-as-product, or Page schema rewrites in a cleanup.
- Delete Page DTO, ports, mock PageStore, Latte CodePort, or CreatorShell because a WP adapter used to implement them.
- Treat domain status `published` as WordPress-specific.

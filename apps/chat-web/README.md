# chat-web

SvelteKit SPA for the SI Chat Creator (browser-first).

## Run

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Mock ChatCore (localStorage) is the default. Protected Grok uses `/runtime`, not Session HTTP.

```sh
npm run build
```

Creator shell (ADR-0003): AppNav (~248px) | ChatColumn (`w-80`) | Workspace (BlockTree + Preview/Code). Below `lg`, Chat | Page tabs. ChatCore: `src/lib/chat-core`. Agent Gateway / cursor-sdk are not wired (ADR-0004).

## UI8Kit

The registry is the single source of UI ([ADR 0008](../../.project/adr/0008-registry-single-source-of-ui.md)).
`../../registry/svelte` is the literal output of `npx ui8kit init --yes --framework svelte` + `npx ui8kit add --all`
(`npm run registry:snapshot`; verify offline with `npm run registry:check`). Do not hand-edit it. App UI in `src/app`
imports registry components through the `$registry` alias; `src/lib` holds logic only (no `.svelte`).

- Font: Istok Web in `src/fonts/` (OFL).
- Colors: shadcn HSL tokens in `src/styles/tokens.css`.
- Strings: `src/lib/i18n/ru.json` (UI is Russian).

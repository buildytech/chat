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

Intended bootstrap:

```sh
npx ui8kit@3 init --yes --framework svelte --dir src
npx ui8kit@3 add box text button icon input textarea form label link separator
```

This tree vendors Svelte 5 primitives under `src/ui` matching `ui8kit/codegen` (tag retag, kit zone may use `<svelte:element>`). Composition in `src/lib` uses those primitives only. Refresh from the registry when npm/CDN is available; do not hand-edit generated kit files after a real `ui8kit add`.

- Font: Istok Web in `src/fonts/` (OFL).
- Radius: `rounded-default` → `--radius`.
- Colors: shadcn HSL tokens in `src/styles/tokens.css`.
- Strings: `src/lib/i18n/ru.json` (UI is Russian).

# chat-web

SvelteKit SPA for the SI Chat Website Builder.

## Run

```sh
npm install
npm run dev
```

```sh
npm run build
```

Offline mock session API: `src/lib/api/session.svelte.ts`.

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

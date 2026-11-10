# ADR 0016: Skins are registry items `theme-<skin>`; the chat's skin is part of the session

Status: accepted (2026-11-10). Issue: alexy-os/chaosbun#143.

## Context

A brand is applied through tokens only (colors, radius, shadows, fonts, tracking), never by forking components. The
skin data lives in codegen-x/ui8kit `packages/skins` (`skins/*.json`, `index.json`, `skins build --check`). Until now
the chat could not show or export a skin.

## Decision

- Each skin is a registry item `theme-<skin>` of type `registry:theme` on registry.buildy.tw (built by ui8kit/site's
  registry build from codegen-x, never hand-written). `npx ui8kit add theme-<skin>` (ui8kit CLI 3.5.0) writes
  `src/styles/skins/<skin>.css` and its dependency `theme-base` (`base.css`, `NOTICE.md`), records both in
  `ui8kit.lock.json`, and prints how to turn it on: import the CSS after the styles entry, `data-skin="<skin>"` on
  `<html>`. `add --all` skips themes (a skin is a choice).
- The chat's registry snapshot (`registry/svelte`) carries every theme item as the CLI writes it;
  `sources.json` `themes` lists them (`registrySkins()` in builder-core).
- The skin is a property of one chat: session `skin` (session.schema.json 1.1.0, optional, additive; null or absent is
  the default theme). The preview header has a skin switch (registry Select); the preview document (and the
  standalone `/preview` window) gets theme-base + the skin CSS and `data-skin` on its `<html>`. The chat UI itself never
  wears a skin.
- ZIP export with a skin = `npx ui8kit add <blocks> theme-<skin>`: the theme files byte-identical to the CLI install,
  lock entries for `theme-<skin>` and `theme-base`, `import "./styles/skins/<skin>.css"` in `src/main.ts` after the
  styles entry, `<html lang="en" data-skin="<skin>">`, `manifest.json` `skin`. A skin id the pinned registry does not
  carry exports as the default theme.

## Consequences

- New skins arrive with a registry snapshot refresh (`npm run registry:snapshot`), no chat code change.
- Until `ui8kit@3.5.0` is on npm, refresh the snapshot with `UI8KIT_CLI_BIN=<ui8kit/cli checkout>/dist/index.js`.

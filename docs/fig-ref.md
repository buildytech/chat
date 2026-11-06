# Figma reference notes

Source dump: fig2design of `chat.fig` ("Chat Preview Site" frames at 1600 / 768 / 360).

Slim copies live in `design/fig-ref/` (ARCH, frames-summary, manifest). The full ~21MB dump is **not** stored here.

## Layout to implement

- Desktop ~1600: Sidebar **~248px** + Content.
- 768 / 360: Navigate **64px** + Content (sidebar behind a menu).

## What not to copy from Figma

- Inter → **Istok Web** (embedded in chat-web).
- Kit radii (32 / 56 / …) → UI8Kit **rounded-default** (`--radius`).
- Palette literals → **shadcn HSL tokens**.
- Figma kit components → **UI8Kit Svelte** primitives.

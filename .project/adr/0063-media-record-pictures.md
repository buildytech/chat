# ADR 0063: Media mode draws the large record pictures, read from the registry blocks

Status: accepted (2026-11-21, t121u/t122u, alexy-os/chaosbun#156)

## Context
Media mode drew only a block's own `image` plus the records of a hand-kept list (`LIST_ITEMS`: menu-simple, products-simple,
rooms-simple). Every other record picture a registry block renders kept the built-in placeholder: team portraits,
testimonial and review avatars, feature icons, contact icons, photos, stories, collections, cases. The t120u exam failed 4 of
5 pages on it. The owner then set the scope (t122u): small pictures may stay placeholders; only the large ones are drawn.

## Decision
- `scripts/lib/registry-derive.mjs` `derivePictures` reads each pinned block (`registry/svelte/src/blocks/<item>.svelte`). For
  every `<MediaFrame>` inside an `{#each <list> as <row>}` whose `src` is a row field, it records:
  - the list prop, the picture field and the alt field;
  - the frame ratio and a size class, each a literal or a case of one layout prop (the block's `$derived` chain).
  - Output: `packages/builder-core/src/catalog/pictures.json`, a derived artifact (snapshot --derive / --check). Nothing listed by hand.
- Size class, from the frame's own class:
  - **small**: a fixed `size-N` with N <= 12 (up to 48px). Feature icons, reviewer avatars, contact and policy icons, team byline discs.
  - **large**: every other frame (it follows its column). Menu, product and room cards, team portraits (`size-16` / full width), photos, stories, collections, cases.
  - **logo**: a loop body marked `data-slot="logo"`. A brand's own asset, never drawn.
- `imageSlots` (apps/chat-web/src/modules/chat/media/slots.ts) has two parts:
  - a block's own picture, as before (`ASPECT_OF`);
  - one slot per record of every **large** record picture, from `recordPictures(item, props)` (builder-core):
    - key `<block id>/<list>/<i>`, so `items` keeps the old keys and the `ext.media` of earlier sessions;
    - pointer `/<list>/<i>/<field>`;
    - aspect from the ratio;
    - an `avatar` is prompted as a portrait.
- Small and logo pictures get no slot and keep the placeholder. The exam criterion (a) counts placeholders among large pictures only.
- Pick / write / reload persistence (`ext.media`), preview and the ZIP export were already generic by pointer. pack-images
  collects `image` and `avatar` at any depth, so the new slots need no change there.

## Consequences
- A new registry block with record pictures gets slots by the snapshot, with no chat change.
- A block whose frame ratio or class is neither a literal nor a one-prop case fails the derive loudly (ratio). A class like
  that counts as large.

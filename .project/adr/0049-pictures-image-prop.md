# 0049. Pictures: an optional `image` / `imageAlt` replaces the placeholder; a bad address is dropped

Status: accepted (owner decision 15.11: flat fields `image` and `imageAlt`)

## Context

Owner session 15.11 asked the Build agent to replace placeholders with stock photos. No registry block had an image prop (ADR 0048, item 4), so the request
could not be met. codegen-x b6166342 adds the prop to the registry (spec `MediaFrame`: an empty `src` is none; the placeholder has `alt=""`; a real picture has its
alt text, `loading="lazy"`, `decoding="async"`); the registry is published at registry.buildy.tw (ui8kit/site 368d46b2).

## Decision

1. **Fields.** Flat, optional text props: `image` (an https URL or a relative path) and `imageAlt` (default: the title) on 22 section blocks (hero-split, hero-classic,
   cta-band, about-me, feature-split, team-grid, ...), and `image` on the list records Feature, Quote, Photo, Member, Project, Template, Tile, Dish, DishOption, CartLine
   (photo-gallery, lightbox-gallery, team-grid, project-grid, dish-*, product cards, cart lines, ...). Without `image` the block shows its placeholder.
2. **Inspector.** `image` is a plain text field (kind `text`, flag `image: true` in the field tree); no new widget.
3. **Write gate.** `write_page` keeps a valid value and drops a bad one (not https, protocol-relative, spaces, markup, over 2048 characters; relative paths are valid)
   with a note, like an unknown icon (ADR 0048); the page is written (`catalog/image-url.ts`, `repairIcons` walk). The Inspector set goes through the same write.
4. **Prompt.** Never invent a URL; set `image` only when the author gave one or asked for photos, then a direct https URL of a real public photo with a short `imageAlt`.
   Never say in the page text that photos were added unless `image` is set.
5. **Export.** A page with pictures exports the registry's own files; `export-cli.test.ts` has a sample with pictures and compares with `npx ui8kit` (golden regenerated, live check passed).

## Consequences

No server-side fetch or HEAD check of a picture's address: a well-formed URL that does not load shows a broken image; the model has no web tool, so a URL it
writes is from memory and may not exist (measure in live runs). `Feature.image` appears in the schemas of a few blocks that do not render it (usp-strip,
contact-form, delivery-info, icon-wall, reservation-form, support-channels, about-company, cta-proof, faq-split); it is ignored there. Avatars, nav, map and profile
blocks have no picture prop. Money stays out of this (ADR 0046).

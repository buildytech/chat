# ADR 0064: a word in a picture field renders the placeholder

Status: accepted (2026-11-22, t123u)

## Context
On the t121u exam the Build model wrote icon names into the contact cards' picture field (`image: "phone"`, `"map-pin"`,
`"clock"`). `isImageUrl` (ADR 0049) took any scheme-less value as a relative path, so the words were kept and every view
requested `/phone`: three broken pictures in the preview, the ZIP export and after a reload.

## Decision
- One predicate, `catalog/image-url.ts` `isImageUrl`: an https URL with a host, or a relative path whose last segment ends in
  a picture extension (jpg, jpeg, png, webp, gif, avif, svg; a query or hash may follow). A bare word is not an address.
  http:, data: and other schemes stay refused, as in ADR 0049.
- The write path keeps using it (`write_page` and the Inspector drop such a value with a note).
- `renderBlock` (the one render the preview, the code pane and the ZIP export share) blanks every picture field (`image`,
  `imageDark`, `avatar` at any depth) that fails the predicate, so a page saved before the rule shows the registry placeholder
  too; preview, export and reload agree.
- The Build prompt says picture fields hold only an image URL or stay empty, never an icon name or a word (page-agent/15).

## Consequences
- A relative picture path needs its file extension; the app itself writes only https addresses (Media mode) and imports
  (export), so nothing it produces changes.

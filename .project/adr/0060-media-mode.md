# ADR 0060: Media mode draws the page pictures from imageAlt with Grok Imagine

Status: accepted, 2026-11-21 (owner t108u / t109u).

## Decision

1. **Third composer mode.** Ask / Build / Media. Media is not a chat and not an agent mode: the session `mode` enum stays `ask | build` (vendored schema);
   the Media choice is `ext.media.active` of the project. It works on the page Preview shows.
2. **Slots are the existing props.** A picture slot is a block's `image` + `imageAlt` (hero, promo, feature-showcase, figure, article-lead, product, split,
   locations, profile-intro) or `items[i].image` of a picture list (menu, products, rooms). Generation only fills `image`, through the inspector page gate
   (one undo step per pick); block DOM, ARIA and props budgets do not change.
3. **imageAlt is the prompt core.** Build writes on every slot a natural, descriptive sentence in the page language (subject, key details, setting; no
   "image of", no keyword stuffing) even without `image` (POLICY page-agent/14). Prompt = imageAlt (a list record: title + description) + optional
   per-picture extra + page art direction (`ext.media.style`, default from the skin) + the frame of the variant (`slots.ts`, read from the registry
   `MediaFrame` ratio expressions) + "no text in the image". A changed frame or alt marks the candidates stale.
4. **Server only.** `POST /runtime/v1/media` (`apps/xai-runtime/src/media.ts`, `api/runtime/v1/media.ts`): `generate` submits a deferred
   `POST /v1/images/generations` (model `grok-imagine-image-2.0`, n = 3, `aspect_ratio`), `result` polls `GET /v1/images/{request_id}` (404 and 202 read as
   pending). `XAI_API_KEY` never leaves the runtime.
5. **Side data.** `ext.media` = `{ active, style, slots: { <block id | block id/items/i>: { candidates, alt, aspect, extra?, picked?, costUsdTicks, ms, at } } }`.

## Consequences

The returned URLs are temporary `imgen.x.ai` addresses (owner decision: fine for now; storage such as S3 or the xAI Files `storage_options.public_url`
comes later). A picked picture stops loading when the URL expires. Cost is $0.04 per image (3 per slot).

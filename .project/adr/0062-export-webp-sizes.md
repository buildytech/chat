# ADR 0062: The ZIP export ships each picture as WebP sizes, encoded on the server

Status: accepted, 2026-11-21 (owner t117u-t119u).

## Decision

1. **Server encoding with sharp.** `POST /runtime/v1/media?action=encode` (`apps/xai-runtime/src/media-encode.ts`, the media function; sharp 0.35
   with its linux-x64 glibc binaries, a dynamic import the bundler keeps external so Vercel traces it). The original comes as the request body (at
   most 4 MB, under Vercel's 4.5 MB request cap) or, for the xAI image hosts, by `&url=` that the runtime reads itself (at most 24 MB: a 2k Grok
   Imagine picture is a ~7 MB PNG). The answer is JSON with base64 WebP sizes, kept under 3.2 MB of base64 (Vercel's 4.5 MB response cap).
2. **Three tiers, each from the original.** 960 px q72; 1280 px q78 with a mild sharpen (sigma 0.6); 1920 px q82. Never upscaled: a tier wider than
   the original is capped at its width, and tiers that land on the same width keep the smaller tier (a 1152 px Grok Imagine 1k picture gives 960 and
   1152, the 1152 one with the 1280 tier's settings).
3. **A subtle grade before encoding.** `contrast` -0.06 (6% less contrast around mid grey, `linear`) and `cool` 0.03 (red x0.97, blue x1.03,
   `recomb`): defaults in `FILTERS`, overridable per request inside `FILTER_LIMITS` (contrast -0.2..0.1, cool -0.1..0.1) with `&contrast=` /
   `&cool=`. Subtle on purpose: page art direction may be warm (embers, candle light).
4. **In the project.** `src/assets/images/<name>-<width>.webp` for every size; `image` points at the widest size up to 1280 px; where the block's
   published props schema has `imageSrcset` next to `image`, the section passes every size as a template of the size imports
   (`` `${img_hero_960} 960w, ${img_hero_1152} 1152w` ``), so Vite fingerprints each file under any base. The original is not shipped.
5. **Never lose a picture.** A failed encode keeps the original file (`kept: "original"`, `encodeError` in the manifest); a failed download keeps
   the remote address (ADR 0061). A chat-off build has no encoder: originals as in ADR 0061.
6. **Manifest.** `images.totals` (`originalBytes`, `writtenBytes`, `savedBytes`, `savedPercent`), `images.filters`, and per picture the original
   (`bytes`, `type`, `width`, `height`) and each size (`path`, `width`, `height`, `bytes`, `quality`, `sharpen`).

## Consequences

The media function carries sharp (~20 MB of node_modules traced into the function bundle). `srcset` needs the block to take `imageSrcset`
(codegen-x MediaFrame `srcset` / `sizes`, registry, snapshot); until a block does, it gets the middle size as `image`.

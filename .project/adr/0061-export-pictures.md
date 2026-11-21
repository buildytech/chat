# ADR 0061: The ZIP export downloads the page pictures into the project

Status: accepted, 2026-11-21 (owner t116u).

## Decision

1. **Every remote picture goes into the project.** `image`, `imageDark` and `avatar` at any depth of a block's props (sections, list records, photos,
   logos) with an `http(s)` address are downloaded when the ZIP is built (`apps/chat-web/src/lib/page-store/pack-images.ts`). Relative paths stay as they are.
2. **`src/assets/images/<name>.<ext>`, imported by the section.** The section of the block imports each file
   (`import img_hero_image from "../assets/images/hero-image.jpg"`) and passes the import as the prop. Vite then fingerprints the file into
   `dist/assets/`, resolves it under any `base` (a sub-path deploy keeps working, which `public/images` + an absolute `/images/...` would break), and the
   build fails if a file is missing. `src/vite-env.d.ts` (`vite/client`) is added when there are pictures.
3. **Stable names, one file per URL.** The name is `<block id>-<prop pointer>` of the first reference (`block-menu-simple-items-0-image`), a clash gets
   `-2`; every reference to the same URL shares the file. The extension comes from the response `content-type` (jpeg, png, webp, gif, avif; anything else
   stays remote).
4. **A failed download never fails the export.** The address stays remote; `manifest.json` `images.remote` lists it with the reason and the props that use
   it, `images.local` lists the files (path, type, bytes, source, usedBy), the README says so, and the top bar shows how many stayed remote.
5. **CORS: the chat proxies its own hosts.** The export runs in the browser. `imgen.x.ai` (Media mode results) sends no CORS header, so the chat module
   offers an `imageSource` (module port) that reads `imgen.x.ai` and `files-cdn.x.ai` through `POST /runtime/v1/media` `{ action: "asset", url }`
   (`apps/xai-runtime/src/media-asset.ts`): the same gate as every runtime path, https only, those two hosts only, no redirects, a picture type, at most
   4 MB (under the 4.5 MB Vercel response cap), no key needed, the address never logged. Other hosts are read directly by the browser (CORS); without CORS
   they stay remote (rule 4). The core holds no runtime path, so a chat-off build has no proxy and no trace of it.
6. **A conversion step plugs in later.** `localizeImages(page, fetch, transform?)`: `transform` gets the downloaded bytes and type and returns new ones;
   the extension follows the returned type. Compression and WebP go there.

## Consequences

`page.json` keeps the original addresses (it is the document, re-importable); only the generated code points at the files. A temporary `imgen.x.ai`
address must be exported within its lifetime (about 24 h) or it stays remote. The export ZIP is stored (not deflated), so its size is about the sum of
the pictures (the shashlik demo: 8 pictures, 3.5 MB).

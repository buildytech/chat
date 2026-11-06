// ../../packages/page-contract/src/types.ts
var PAGE_LAYOUT_VERSION = 1;
var PAGE_BLOCK_KINDS = [
  "nav",
  "nav-link",
  "hero",
  "features",
  "feature",
  "menu",
  "dish",
  "hours",
  "cta",
  "footer"
];
var PAGE_COPY_KEYS = [
  "eyebrow",
  "headline",
  "lede",
  "action",
  "note",
  "brand",
  "contact",
  "legal",
  "days",
  "address"
];
var PAGE_STATUSES = [
  "draft",
  "pending",
  "scheduled",
  "published",
  "archived",
  "trashed"
];
var PAGE_LIMITS = {
  maxBlocks: 64,
  maxDepth: 4,
  maxIdLength: 63,
  maxSlugLength: 48,
  maxTitleLength: 160,
  maxSummaryLength: 500,
  maxCopyLength: 2e3,
  maxSeoLength: 200,
  maxLocaleLength: 16,
  maxJsonChars: 65536
};
function blocksOf(page) {
  return page.layout.blocks;
}

// ../../packages/page-contract/src/validate.ts
var PageContractError = class extends Error {
  code;
  path;
  constructor(code, path, message) {
    super(`${code} at ${path}: ${message}`);
    this.name = "PageContractError";
    this.code = code;
    this.path = path;
  }
};
var PAGE_KEYS = /* @__PURE__ */ new Set([
  "id",
  "slug",
  "status",
  "title",
  "layout",
  "seo",
  "locale",
  "createdAt",
  "updatedAt"
]);
var LAYOUT_KEYS = /* @__PURE__ */ new Set(["version", "blocks"]);
var BLOCK_KEYS = /* @__PURE__ */ new Set(["id", "kind", "title", "summary", "copy", "children"]);
var SEO_KEYS = /* @__PURE__ */ new Set(["title", "description"]);
var COPY_KEY_SET = new Set(PAGE_COPY_KEYS);
var KIND_SET = new Set(PAGE_BLOCK_KINDS);
var STATUS_SET = new Set(PAGE_STATUSES);
var ID_PATTERN = /^[a-z][a-z0-9-]{0,62}$/;
var SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
var DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
var ALLOWED_URL_SCHEMES = /* @__PURE__ */ new Set(["http:", "https:", "mailto:"]);
var MARKUP_PATTERN = /[<>{}]|<\?/;
function fail(code, path, message) {
  throw new PageContractError(code, path, message);
}
function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function asObject(value, path) {
  if (!isPlainObject(value)) fail("invalid_type", path, "expected object");
  return value;
}
function assertOnlyKeys(obj, allowed, path) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) fail("unexpected_key", path, `unexpected key "${key}"`);
  }
}
function requirePresent(obj, key, path) {
  if (!(key in obj)) fail("missing_field", path, `missing "${key}"`);
  return obj[key];
}
function asString(value, path) {
  if (typeof value !== "string") fail("invalid_type", path, "expected string");
  return value;
}
function assertPlainText(value, path) {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) {
    fail("unsafe_text", path, "control characters are not allowed");
  }
  if (MARKUP_PATTERN.test(value)) {
    fail("unsafe_text", path, "markup or template syntax is not allowed");
  }
}
function assertSafeUrlPolicy(value, path) {
  const stripped = value.replace(/[\u0000-\u0020]/g, "").toLowerCase();
  const match = /^[a-z][a-z0-9+.-]*:/.exec(stripped);
  if (!match) return;
  if (!ALLOWED_URL_SCHEMES.has(match[0])) {
    fail("unsafe_url", path, `scheme "${match[0]}" is not allowed`);
  }
}
function parseBoundedText(value, path, maxLength, options = {}) {
  const text = asString(value, path);
  if (options.required && text.trim() === "") {
    fail("empty_required", path, "must be non-empty");
  }
  if (text.length > maxLength) fail("too_long", path, `exceeds ${maxLength} characters`);
  assertPlainText(text, path);
  assertSafeUrlPolicy(text, path);
  if (options.pattern && !options.pattern.test(text)) {
    fail(options.patternCode ?? "invalid_type", path, "value does not match required pattern");
  }
  return text;
}
function parseId(value, path, seen) {
  const id = parseBoundedText(value, path, PAGE_LIMITS.maxIdLength, {
    required: true,
    pattern: ID_PATTERN,
    patternCode: "invalid_id"
  });
  if (seen.has(id)) fail("duplicate_id", path, `duplicate id "${id}"`);
  seen.add(id);
  return id;
}
function parseCopy(value, path) {
  const obj = asObject(value, path);
  assertOnlyKeys(obj, COPY_KEY_SET, path);
  const copy = {};
  for (const key of PAGE_COPY_KEYS) {
    if (!(key in obj)) continue;
    copy[key] = parseBoundedText(obj[key], `${path}.${key}`, PAGE_LIMITS.maxCopyLength);
  }
  return copy;
}
function parseBlock(value, path, depth, seen, counts) {
  if (depth > PAGE_LIMITS.maxDepth) {
    fail("too_deep", path, `tree deeper than ${PAGE_LIMITS.maxDepth}`);
  }
  counts.blocks += 1;
  if (counts.blocks > PAGE_LIMITS.maxBlocks) {
    fail("too_many_blocks", path, `more than ${PAGE_LIMITS.maxBlocks} blocks`);
  }
  const obj = asObject(value, path);
  assertOnlyKeys(obj, BLOCK_KEYS, path);
  const id = parseId(requirePresent(obj, "id", path), `${path}.id`, seen);
  const kindRaw = asString(requirePresent(obj, "kind", path), `${path}.kind`);
  if (!KIND_SET.has(kindRaw)) {
    fail("unsupported_kind", `${path}.kind`, `unsupported block kind "${kindRaw}"`);
  }
  const kind = kindRaw;
  const title = parseBoundedText(requirePresent(obj, "title", path), `${path}.title`, PAGE_LIMITS.maxTitleLength, {
    required: true
  });
  const summary = parseBoundedText(
    requirePresent(obj, "summary", path),
    `${path}.summary`,
    PAGE_LIMITS.maxSummaryLength,
    { required: true }
  );
  const block = { id, kind, title, summary };
  if ("copy" in obj) {
    block.copy = parseCopy(obj.copy, `${path}.copy`);
  }
  if ("children" in obj) {
    if (!Array.isArray(obj.children)) fail("invalid_type", `${path}.children`, "expected array");
    block.children = obj.children.map(
      (child, index) => parseBlock(child, `${path}.children[${index}]`, depth + 1, seen, counts)
    );
  }
  return block;
}
function parseSeo(value, path) {
  const obj = asObject(value, path);
  assertOnlyKeys(obj, SEO_KEYS, path);
  const seo = {};
  if ("title" in obj) {
    seo.title = parseBoundedText(obj.title, `${path}.title`, PAGE_LIMITS.maxSeoLength);
  }
  if ("description" in obj) {
    seo.description = parseBoundedText(obj.description, `${path}.description`, PAGE_LIMITS.maxSeoLength);
  }
  return seo;
}
function parseLayout(value, path, seen) {
  const obj = asObject(value, path);
  assertOnlyKeys(obj, LAYOUT_KEYS, path);
  const version = requirePresent(obj, "version", path);
  if (typeof version !== "number" || !Number.isInteger(version)) {
    fail("invalid_type", `${path}.version`, "expected integer");
  }
  if (version !== PAGE_LAYOUT_VERSION) {
    fail("unsupported_version", `${path}.version`, `unsupported layout.version ${String(version)}`);
  }
  const blocksRaw = requirePresent(obj, "blocks", path);
  if (!Array.isArray(blocksRaw)) fail("invalid_type", `${path}.blocks`, "expected array");
  const counts = { blocks: 0 };
  const blocks = blocksRaw.map(
    (block, index) => parseBlock(block, `${path}.blocks[${index}]`, 1, seen, counts)
  );
  return { version: PAGE_LAYOUT_VERSION, blocks };
}
function parsePage(input) {
  if (typeof input === "string" && input.length > PAGE_LIMITS.maxJsonChars) {
    fail("too_large", "$", "payload exceeds size limit");
  }
  let encoded;
  try {
    encoded = JSON.stringify(input);
  } catch {
    fail("invalid_type", "$", "value is not JSON-serializable");
  }
  if (encoded.length > PAGE_LIMITS.maxJsonChars) {
    fail("too_large", "$", "payload exceeds size limit");
  }
  const obj = asObject(input, "$");
  assertOnlyKeys(obj, PAGE_KEYS, "$");
  const seen = /* @__PURE__ */ new Set();
  const id = parseId(requirePresent(obj, "id", "$"), "id", seen);
  const slug = parseBoundedText(requirePresent(obj, "slug", "$"), "slug", PAGE_LIMITS.maxSlugLength, {
    required: true,
    pattern: SLUG_PATTERN,
    patternCode: "invalid_slug"
  });
  const statusRaw = asString(requirePresent(obj, "status", "$"), "status");
  if (!STATUS_SET.has(statusRaw)) {
    fail("invalid_status", "status", `unsupported status "${statusRaw}"`);
  }
  const status = statusRaw;
  const title = parseBoundedText(requirePresent(obj, "title", "$"), "title", PAGE_LIMITS.maxTitleLength, {
    required: true
  });
  const layout = parseLayout(requirePresent(obj, "layout", "$"), "layout", seen);
  const seo = parseSeo(requirePresent(obj, "seo", "$"), "seo");
  const locale = parseBoundedText(requirePresent(obj, "locale", "$"), "locale", PAGE_LIMITS.maxLocaleLength, {
    required: true,
    pattern: LOCALE_PATTERN,
    patternCode: "invalid_locale"
  });
  const createdAt = parseBoundedText(requirePresent(obj, "createdAt", "$"), "createdAt", 40, {
    required: true,
    pattern: DATETIME_PATTERN,
    patternCode: "invalid_datetime"
  });
  const updatedAt = parseBoundedText(requirePresent(obj, "updatedAt", "$"), "updatedAt", 40, {
    required: true,
    pattern: DATETIME_PATTERN,
    patternCode: "invalid_datetime"
  });
  return { id, slug, status, title, layout, seo, locale, createdAt, updatedAt };
}

// src/lib/page-store/tree.ts
function walkBlocks(blocks) {
  const out = [];
  for (const block of blocks) {
    out.push(block);
    if (block.children?.length) {
      out.push(...walkBlocks(block.children));
    }
  }
  return out;
}

// src/lib/page-store/latte.ts
function macroName(id) {
  return id.replace(/-/g, "_");
}
function selectedMark(block, selectedId) {
  return block.id === selectedId ? " {* selected *}" : "";
}
function copyLines(block, indent) {
  const copy = block.copy;
  if (!copy) return [];
  const lines = [];
  for (const key of PAGE_COPY_KEYS) {
    if (!copy[key]) continue;
    lines.push(
      `${indent}<p data-copy="${key}">{$page->blocks['${block.id}']['copy']['${key}']}</p>`
    );
  }
  return lines;
}
function emitDefine(block, selectedId) {
  const name = macroName(block.id);
  const selectedAttr = block.id === selectedId ? ` data-selected="true"` : "";
  const lines = [
    `{define #${name}}`,
    `	<section data-block="${block.kind}" data-id="${block.id}"${selectedAttr}>`,
    `		<h2>{$page->blocks['${block.id}']['title']}</h2>`
  ];
  lines.push(...copyLines(block, "		"));
  if (block.children?.length) {
    lines.push(`		{foreach $page->blocks['${block.id}']['children'] as $child}`);
    lines.push(`			{include #item, item: $child}`);
    lines.push(`		{/foreach}`);
  }
  lines.push(`	</section>`);
  lines.push(`{/define}`);
  return lines;
}
function latteForBlock(block, selectedId = null) {
  return emitDefine(block, selectedId).join("\n") + "\n";
}
function latteFromPage(page, selectedId = null) {
  const roots = blocksOf(page);
  const nodes = walkBlocks(roots);
  const lines = [
    `{* CodePort page from DTO ${page.id} (${page.slug}). Requires Main/page.latte. ADR-0003. *}`,
    `{layout 'Main/page.latte'}`,
    ``,
    `{var $selectedId = '${selectedId ?? ""}'}`,
    `{var $pageTitle = $page->title}`,
    ``,
    `{define #item, $item}`,
    `	<article data-block="{$item['kind']}" data-id="{$item['id']}">`,
    `		<h3>{$item['title']}</h3>`,
    `		<p>{$item['summary']}</p>`,
    `		{if $item['id'] === $selectedId}{* selected child *}{/if}`,
    `	</article>`,
    `{/define}`,
    ``
  ];
  for (const node of nodes) {
    lines.push(...emitDefine(node, selectedId));
    lines.push(``);
  }
  lines.push(`{block #content}`);
  for (const block of roots) {
    lines.push(`	{include #${macroName(block.id)}}${selectedMark(block, selectedId)}`);
  }
  lines.push(`{/block}`);
  lines.push(``);
  return lines.join("\n");
}

// src/lib/page-store/codeport-runtime.ts
var COIMPORT_PACK_FILES = [
  {
    path: "Main/page.latte",
    content: `{* CodePort runtime layout \u2014 required by latteFromPage \`{layout 'Main/page.latte'}\`. *}
<!DOCTYPE html>
<html lang="{$page->locale}">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>{$pageTitle}</title>
	{ifset $page->seo}
		{ifset $page->seo['description']}<meta name="description" content="{$page->seo['description']}">{/ifset}
	{/ifset}
</head>
<body>
	<main data-codeport="page" data-page-id="{$page->id}" data-slug="{$page->slug}" data-status="{$page->status}">
		{block content}{/block}
	</main>
</body>
</html>
`
  },
  {
    path: "codeport-pack/README.md",
    content: "# CodePort Latte runtime pack\n\nTemplates required to **compile** exact `latteFromPage` / CodePane ZIP output with PHP Latte 3.\n\n| Path | Role |\n| --- | --- |\n| `Main/page.latte` | Layout referenced by `{layout 'Main/page.latte'}` in emitted `page.latte` |\n\nPackaged into downloads via `packFilesFromPage` under `runtime/` (see GENERATOR.json).\n"
  }
];

// src/lib/page-store/pack.ts
function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}
var CRC_TABLE = crcTable();
function crc32(data) {
  let c = 4294967295;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 255] ^ c >>> 8;
  }
  return (c ^ 4294967295) >>> 0;
}
function u16(n) {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, n, true);
  return out;
}
function u32(n) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
}
function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
function buildStoreZip(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.path.replace(/\\/g, "/"));
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const utf8Flag = 2048;
    const local = concat([
      u32(67324752),
      u16(20),
      u16(utf8Flag),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data
    ]);
    const central = concat([
      u32(33639248),
      u16(20),
      u16(20),
      u16(utf8Flag),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralDir = concat(centrals);
  const eocd = concat([
    u32(101010256),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0)
  ]);
  return concat([...locals, centralDir, eocd]);
}
function sha256Text(s) {
  const bytes = new TextEncoder().encode(s);
  return sha256Hex(bytes);
}
function sha256Hex(data) {
  const K = new Uint32Array([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  const rr = (x, n) => x >>> n | x << 32 - n;
  let h0 = 1779033703, h1 = 3144134277, h2 = 1013904242, h3 = 2773480762;
  let h4 = 1359893119, h5 = 2600822924, h6 = 528734635, h7 = 1541459225;
  const l = data.length;
  const bit = l * 8;
  const withPad = new Uint8Array(l + 9 + 63 >> 6 << 6);
  withPad.set(data);
  withPad[l] = 128;
  new DataView(withPad.buffer).setUint32(withPad.length - 4, bit >>> 0, false);
  const w = new Uint32Array(64);
  for (let i = 0; i < withPad.length; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = new DataView(withPad.buffer).getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const v1 = w[j - 15], s0 = rr(v1, 7) ^ rr(v1, 18) ^ v1 >>> 3;
      const v2 = w[j - 2], s1 = rr(v2, 17) ^ rr(v2, 19) ^ v2 >>> 10;
      w[j] = w[j - 16] + s0 + w[j - 7] + s1 >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 64; j++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      const ch = e & f ^ ~e & g;
      const t1 = h + S1 + ch + K[j] + w[j] >>> 0;
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = S0 + maj >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    h0 = h0 + a >>> 0;
    h1 = h1 + b >>> 0;
    h2 = h2 + c >>> 0;
    h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0;
    h5 = h5 + f >>> 0;
    h6 = h6 + g >>> 0;
    h7 = h7 + h >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, "0")).join("");
}
function codeportRuntimeFiles() {
  return COIMPORT_PACK_FILES.map((f) => ({ path: f.path, content: f.content }));
}
function packFilesFromPage(page, selectedId = null) {
  const valid = parsePage(page);
  const pageLatte = latteFromPage(valid, selectedId);
  const files = [{ path: "page.latte", content: pageLatte }];
  for (const block of walkBlocks(blocksOf(valid))) {
    files.push({
      path: `blocks/${block.id}.latte`,
      content: latteForBlock(block, selectedId)
    });
  }
  const runtime = codeportRuntimeFiles();
  files.push(...runtime);
  files.push({
    path: "page.json",
    content: `${JSON.stringify(valid, null, 2)}
`
  });
  const generator = {
    name: "@buildytech/chat-web/codeport",
    emitter: "latteFromPage",
    packApi: "packFilesFromPage",
    packageVersion: "0.0.0",
    pageLatteSha256: sha256Text(pageLatte),
    runtimeFiles: runtime.map((f) => ({ path: f.path, sha256: sha256Text(f.content) })),
    contract: "layout Main/page.latte; $page object with title/id/slug/locale/status/seo and blocks[id] arrays"
  };
  files.push({
    path: "GENERATOR.json",
    content: `${JSON.stringify(generator, null, 2)}
`
  });
  const paths = files.map((file) => file.path).concat("manifest.json");
  const manifest = {
    id: valid.id,
    slug: valid.slug,
    title: valid.title,
    status: valid.status,
    locale: valid.locale,
    seo: valid.seo,
    files: paths,
    generator: {
      name: generator.name,
      emitter: generator.emitter,
      pageLatteSha256: generator.pageLatteSha256
    }
  };
  files.push({
    path: "manifest.json",
    content: `${JSON.stringify(manifest, null, 2)}
`
  });
  return files;
}
function downloadPageZip(page, selectedId = null) {
  if (typeof document === "undefined") return;
  const bytes = buildStoreZip(packFilesFromPage(page, selectedId));
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/zip" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `${page.slug || "page"}-pack.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
export {
  buildStoreZip,
  downloadPageZip,
  packFilesFromPage
};

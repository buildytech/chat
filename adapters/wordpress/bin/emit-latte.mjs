#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const pageJsonPath = arg("--page-json");
const outDir = arg("--out");
const phpBin = arg("--php", "php");
const latteAutoload = arg("--latte-autoload");
if (!pageJsonPath || !outDir || !latteAutoload) {
  console.error("usage: emit-latte.mjs --page-json P --out O --php BIN --latte-autoload A");
  process.exit(2);
}
const bundledLatte = join(__dirname, "latte-from-page.mjs");
const bundledPack = join(__dirname, "pack-from-page.mjs");
const repoLatte = resolve(__dirname, "../../../apps/chat-web/src/lib/page-store/latte.ts");
const repoPack = resolve(__dirname, "../../../apps/chat-web/src/lib/page-store/pack.ts");
const repoRuntime = resolve(__dirname, "../../../apps/chat-web/src/lib/page-store/codeport-runtime.ts");
const repoMain = resolve(__dirname, "../../../apps/chat-web/codeport-pack/Main/page.latte");
const pluginMain = resolve(__dirname, "../codeport/Main/page.latte");

let latteFromPage, packFilesFromPage, COIMPORT_PACK_FILES;
if (existsSync(bundledLatte) && existsSync(bundledPack)) {
  ({ latteFromPage } = await import(pathToFileURL(bundledLatte).href));
  ({ packFilesFromPage } = await import(pathToFileURL(bundledPack).href));
  COIMPORT_PACK_FILES = [{ path: "Main/page.latte", content: readFileSync(existsSync(pluginMain)?pluginMain:repoMain, "utf8") }];
} else {
  ({ latteFromPage } = await import(pathToFileURL(repoLatte).href));
  ({ packFilesFromPage } = await import(pathToFileURL(repoPack).href));
  ({ COIMPORT_PACK_FILES } = await import(pathToFileURL(repoRuntime).href));
}

const envelope = JSON.parse(readFileSync(pageJsonPath, "utf8"));
const dto = envelope.page;
const revision = envelope.revision ?? 0;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
mkdirSync(join(outDir, "pack"), { recursive: true });
mkdirSync(join(outDir, "tmp"), { recursive: true });
mkdirSync(join(outDir, "dist"), { recursive: true });
const mainPath = existsSync(pluginMain) ? pluginMain : repoMain;
const diskMain = readFileSync(mainPath, "utf8");
const exactPageLatte = latteFromPage(dto, null);
const files = packFilesFromPage(dto, null);
for (const f of files) {
  const dest = join(outDir, "pack", f.path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, f.content);
}
function flattenBlocks(blocks, out = {}) {
  for (const b of blocks || []) {
    out[b.id] = { id: b.id, kind: b.kind, title: b.title ?? "", summary: b.summary ?? "", copy: b.copy ?? {}, children: b.children ?? [] };
    if (b.children?.length) flattenBlocks(b.children, out);
  }
  return out;
}
const pageObject = {
  id: dto.id, slug: dto.slug, status: dto.status, title: dto.title, locale: dto.locale,
  seo: dto.seo ?? {}, createdAt: dto.createdAt, updatedAt: dto.updatedAt, layout: dto.layout,
  blocks: flattenBlocks(dto.layout?.blocks || []),
};
writeFileSync(join(outDir, "page-object.json"), JSON.stringify(pageObject) + "\n");
const renderPhp = `<?php
declare(strict_types=1);
require ${JSON.stringify(latteAutoload)};
$out = ${JSON.stringify(outDir)};
$raw = json_decode(file_get_contents($out . '/page-object.json'), true, 512, JSON_THROW_ON_ERROR);
$page = new stdClass();
foreach (['id','slug','status','title','locale','createdAt','updatedAt'] as $k) { $page->$k = $raw[$k] ?? null; }
$page->seo = $raw['seo'] ?? [];
$page->blocks = $raw['blocks'];
$page->layout = $raw['layout'];
$latte = new Latte\\Engine();
$latte->setTempDirectory($out . '/tmp');
$latte->setLoader(new Latte\\Loaders\\FileLoader($out . '/pack'));
$html = $latte->renderToString('page.latte', ['page' => $page]);
$htmlPath = $out . '/dist/' . $page->id . '-rev' . ${JSON.stringify(String(revision))} . '.html';
file_put_contents($htmlPath, $html);
$meta = [
  'ok' => true, 'pageId' => $page->id, 'slug' => $page->slug, 'revision' => ${Number(revision)},
  'draftId' => $page->id, 'status' => $page->status, 'htmlPath' => $htmlPath,
  'htmlBytes' => strlen($html), 'htmlSha256' => hash('sha256', $html),
  'pageLatteSha256' => ${JSON.stringify(sha256(exactPageLatte))},
  'emitter' => 'latteFromPage', 'layout' => 'Main/page.latte',
];
file_put_contents($out . '/render-meta.json', json_encode($meta, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE) . "\\n");
echo json_encode($meta, JSON_UNESCAPED_UNICODE), "\\n";
`;
writeFileSync(join(outDir, "render.php"), renderPhp);
execFileSync(phpBin, [join(outDir, "render.php")], { stdio: "inherit" });

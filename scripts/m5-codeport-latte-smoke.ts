#!/usr/bin/env npx tsx
/** M5: exact latteFromPage pack → PHP Latte 3 compile/render + semantic verify. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { packFilesFromPage, buildStoreZip } from "../apps/chat-web/src/lib/page-store/pack.ts";
import { latteFromPage } from "../apps/chat-web/src/lib/page-store/latte.ts";
import { COIMPORT_PACK_FILES } from "../apps/chat-web/src/lib/page-store/codeport-runtime.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function flattenBlocks(blocks: any[], out: Record<string, any> = {}) {
	for (const b of blocks || []) {
		out[b.id] = {
			id: b.id,
			kind: b.kind,
			title: b.title ?? "",
			summary: b.summary ?? "",
			copy: b.copy ?? {},
			children: b.children ?? []
		};
		if (b.children?.length) flattenBlocks(b.children, out);
	}
	return out;
}

const outDir = process.env.M5_OUT || "/workspace/var/phpingineer/logs/m5-codeport";
const dbPath = process.env.PAGE_STORE_PATH || "/home/box/.config/buildy-demo/pages.sqlite";
const pageId = process.env.M5_PAGE_ID || "page-5975af4003592b2c";
const sessionId = process.env.M5_SESSION_ID || "sess-dcfe3398319aee1e";
const phpBin = process.env.PHP_BIN || "/workspace/bin/php";
const latteVendor = process.env.M5_LATTE_VENDOR || "/workspace/wpfasty-agpl/themes/latte/vendor";

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "pack"), { recursive: true });
mkdirSync(join(outDir, "tmp"), { recursive: true });
mkdirSync(join(outDir, "dist"), { recursive: true });

const db = new DatabaseSync(dbPath, { readOnly: true });
const row = db.prepare("SELECT id, slug, revision, dto_json, updated_at FROM pages WHERE id = ?").get(pageId) as any;
if (!row) throw new Error(`page not found: ${pageId}`);
const dto = JSON.parse(row.dto_json);
const sess = db.prepare("SELECT id, page_id, page_revision FROM sessions WHERE id = ?").get(sessionId) as any;
if (!sess || sess.page_id !== pageId) throw new Error("session/page mismatch");
if (Number(sess.page_revision) !== Number(row.revision)) throw new Error("revision mismatch");

const diskMain = readFileSync(join(REPO, "apps/chat-web/codeport-pack/Main/page.latte"), "utf8");
const embedded = COIMPORT_PACK_FILES.find((f) => f.path === "Main/page.latte");
if (!embedded || embedded.content !== diskMain) {
	throw new Error("codeport-runtime.ts out of sync with codeport-pack/Main/page.latte");
}

const exactPageLatte = latteFromPage(dto, null);
const files = packFilesFromPage(dto, null);
const pageFile = files.find((f) => f.path === "page.latte");
if (!pageFile || pageFile.content !== exactPageLatte) {
	throw new Error("pack page.latte !== exact latteFromPage output");
}
if (!files.some((f) => f.path === "Main/page.latte")) throw new Error("Main/page.latte missing");
if (!exactPageLatte.includes("{layout 'Main/page.latte'}")) throw new Error("missing layout directive");

for (const f of files) {
	const dest = join(outDir, "pack", f.path);
	mkdirSync(dirname(dest), { recursive: true });
	writeFileSync(dest, f.content);
}
const zip = buildStoreZip(files);
writeFileSync(join(outDir, "dist", `${dto.slug}-pack.zip`), zip);

writeFileSync(
	join(outDir, "page-meta.json"),
	JSON.stringify(
		{
			sessionId,
			pageId: row.id,
			slug: row.slug,
			revision: row.revision,
			updatedAt: row.updated_at,
			dtoSha256: sha256(row.dto_json),
			pageLatteSha256: sha256(exactPageLatte),
			generator: JSON.parse(files.find((f) => f.path === "GENERATOR.json")!.content)
		},
		null,
		2
	) + "\n"
);

writeFileSync(
	join(outDir, "page-object.json"),
	JSON.stringify({
		id: dto.id,
		slug: dto.slug,
		status: dto.status,
		title: dto.title,
		locale: dto.locale,
		seo: dto.seo ?? {},
		createdAt: dto.createdAt,
		updatedAt: dto.updatedAt,
		layout: dto.layout,
		blocks: flattenBlocks(dto.layout?.blocks || [])
	}) + "\n"
);

const rev = String(row.revision);
const renderPhp = `<?php
declare(strict_types=1);
require ${JSON.stringify(latteVendor + "/autoload.php")};
$out = ${JSON.stringify(outDir)};
$raw = json_decode(file_get_contents($out . '/page-object.json'), true, 512, JSON_THROW_ON_ERROR);
$page = new stdClass();
foreach (['id','slug','status','title','locale','createdAt','updatedAt'] as $k) {
  $page->$k = $raw[$k] ?? null;
}
$page->seo = $raw['seo'] ?? [];
$page->blocks = $raw['blocks'];
$page->layout = $raw['layout'];
$latte = new Latte\\Engine();
$latte->setTempDirectory($out . '/tmp');
$latte->setLoader(new Latte\\Loaders\\FileLoader($out . '/pack'));
$html = $latte->renderToString('page.latte', ['page' => $page]);
$htmlPath = $out . '/dist/' . $page->id . '-rev' . ${JSON.stringify(rev)} . '.html';
file_put_contents($htmlPath, $html);
$meta = [
  'ok' => true,
  'pageId' => $page->id,
  'slug' => $page->slug,
  'revision' => ${Number(row.revision)},
  'sessionId' => ${JSON.stringify(sessionId)},
  'htmlPath' => $htmlPath,
  'htmlBytes' => strlen($html),
  'htmlSha256' => hash('sha256', $html),
  'pageLatteSha256' => ${JSON.stringify(sha256(exactPageLatte))},
  'dtoSha256' => ${JSON.stringify(sha256(row.dto_json))},
  'emitter' => 'latteFromPage',
  'layout' => 'Main/page.latte',
  'php' => PHP_VERSION,
  'generator' => json_decode(file_get_contents($out . '/pack/GENERATOR.json'), true),
];
file_put_contents($out . '/dist/render-meta.json', json_encode($meta, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE) . "\\n");
echo json_encode($meta, JSON_UNESCAPED_UNICODE), "\\n";
`;
writeFileSync(join(outDir, "render.php"), renderPhp);
execFileSync(phpBin, [join(outDir, "render.php")], { stdio: "inherit" });

const html = readFileSync(join(outDir, `dist/${pageId}-rev${row.revision}.html`), "utf8");
const dishMarks = [...html.matchAll(/data-block="dish"/g)];
const expectedDishes: any[] = [];
for (const b of dto.layout.blocks || []) {
	if (b.kind === "menu" && Array.isArray(b.children)) {
		for (const c of b.children) if (c.kind === "dish") expectedDishes.push(c);
	}
}
const missing = expectedDishes.filter((d) => !html.includes(`data-id="${d.id}"`) || !html.includes(d.title));
const report = {
	ok: dishMarks.length === expectedDishes.length && missing.length === 0 && html.includes(`data-page-id="${pageId}"`),
	dishCountHtml: dishMarks.length,
	dishCountDto: expectedDishes.length,
	expectedTitles: expectedDishes.map((d) => d.title),
	missing: missing.map((d) => d.id),
	hasDoctype: html.includes("<!DOCTYPE html>"),
	hasPageIdAttr: html.includes(`data-page-id="${pageId}"`),
	pageLatteSha256: sha256(exactPageLatte),
	htmlSha256: sha256(html),
	revision: row.revision,
	zipBytes: zip.length,
	packFiles: files.map((f) => f.path),
	exactEmitter: true,
	handwrittenSubstitute: false
};
writeFileSync(join(outDir, "dist/semantic-verify.json"), JSON.stringify(report, null, 2) + "\n");
if (!report.ok) {
	console.error("SEMANTIC FAIL", report);
	process.exit(1);
}
console.log(JSON.stringify(report, null, 2));

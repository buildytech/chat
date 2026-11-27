/**
 * Go templ export end to end (ADR 0069, live: needs Go and the Go module proxy). For each starter preset: the ZIP of the
 * studio page (pictures downloaded by a stand-in) unpacked; `go generate` and `templ generate` leave it unchanged; go vet,
 * go test, go build and the starter's privacy check pass; `site dev` serves the home with the page's blocks, the preset's sections and the pictures;
 * `ui8px lint` (go preset) finds nothing in the page's blocks. Skipped without `go` on PATH.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync, type SpawnSyncOptions } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { type PageV2 } from "../../packages/page-contract/src/index.ts";
import { emptyPage, writePage } from "../../packages/builder-core/src/index.ts";
import { buildStoreZip } from "../../apps/chat-web/src/lib/page-store/pack.ts";
import { localizeImages } from "../../apps/chat-web/src/lib/page-store/pack-images.ts";
import { packTemplZipFiles } from "../../apps/chat-web/src/lib/page-store/templ-pack.ts";
import { TEMPL_PRESETS, type TemplSnapshot } from "../../apps/chat-web/src/lib/page-store/templ-code.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const STARTER = path.join(ROOT, "registry/templ/starter");
const SECTIONS: Record<string, string[]> = { blog: ["/articles"], corporate: ["/services", "/cases", "/articles"], shop: ["/products", "/articles"] };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/eL9GtQAAAABJRU5ErkJggg==", "base64");
const hasGo = spawnSync("go", ["version"]).status === 0;
const snapshot = JSON.parse(readFileSync(path.join(ROOT, "registry/templ/snapshot.json"), "utf8")) as TemplSnapshot;
const fill = JSON.parse(readFileSync(path.join(ROOT, "scripts/m4-api-tests/fixtures/studio-fill.json"), "utf8")) as PageV2;
const written = writePage(emptyPage({ title: fill.title, locale: "en", now: "2026-11-09T00:00:00.000Z" }), { page: fill }, { now: "2026-11-09T00:00:00.000Z" });
assert.ok(written.ok);
const page = written.page;

const readStarter = async (paths: string[]) => Object.fromEntries(paths.map((p) => [p, p.endsWith(".woff2") ? new Uint8Array(readFileSync(path.join(STARTER, p))) : readFileSync(path.join(STARTER, p), "utf8")]));
const readRegistry = async (paths: string[]) => Object.fromEntries(paths.map((p) => [p, readFileSync(path.join(ROOT, "registry/svelte", p), "utf8")]));

function run(cmd: string, args: string[], cwd: string, opts: SpawnSyncOptions = {}): string {
	const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 64 << 20, ...opts });
	assert.equal(r.status, 0, `${cmd} ${args.join(" ")}\n${r.stdout}\n${r.stderr}`);
	return String(r.stdout);
}
const clean = (dir: string, step: string) => assert.equal(run("git", ["status", "--porcelain"], dir), "", `${step} changed the export`);

async function freePort(): Promise<number> {
	return new Promise((resolve) => {
		const s = createServer().listen(0, "127.0.0.1", () => {
			const port = (s.address() as { port: number }).port;
			s.close(() => resolve(port));
		});
	});
}
async function get(url: string): Promise<{ status: number; body: string }> {
	const r = await fetch(url, { redirect: "manual" });
	return { status: r.status, body: await r.text() };
}

for (const preset of TEMPL_PRESETS) {
	test(`templ ZIP builds and serves, preset ${preset}`, { skip: !hasGo && "no go on PATH", timeout: 900_000 }, async () => {
		const dir = mkdtempSync(path.join(tmpdir(), `templ-${preset}-`));
		try {
			const images = await localizeImages(page, async () => ({ bytes: new Uint8Array(PNG), type: "image/png" }));
			assert.ok(images.local.length > 0 && images.remote.length === 0);
			const zip = buildStoreZip(await packTemplZipFiles(page, snapshot, readStarter, readRegistry, { preset, images }));
			writeFileSync(path.join(dir, "export.zip"), zip);
			console.log(`# ${preset}: ZIP ${zip.length} bytes`);
			run("unzip", ["-q", "export.zip", "-d", "site"], dir);
			const site = path.join(dir, "site");
			run("git", ["init", "-q"], site);
			run("git", ["add", "-A"], site);
			run("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", "zip"], site);
			run("go", ["generate", "./internal/page"], site);
			clean(site, "go generate");
			run("go", ["tool", "templ", "generate"], site);
			clean(site, "templ generate");
			run("go", ["vet", "./..."], site);
			run("go", ["test", "./..."], site);
			run("./scripts/privacy-check.sh", [], site);
			run("go", ["build", "-o", path.join(dir, "site-bin"), "./cmd/site"], site);
			const port = await freePort();
			const server = spawn(path.join(dir, "site-bin"), ["dev", "--http", `127.0.0.1:${port}`, "--dir", path.join(dir, "pb_data")], { cwd: site, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, SITE_PRESET: "" } });
			let log = "";
			server.stdout.on("data", (d) => (log += d));
			server.stderr.on("data", (d) => (log += d));
			try {
				const base = `http://127.0.0.1:${port}`;
				let home: { status: number; body: string } | null = null;
				for (let i = 0; i < 120 && !home; i++) home = await get(`${base}/`).catch(() => new Promise<null>((r) => setTimeout(() => r(null), 500)));
				assert.ok(home, `site dev did not answer\n${log}`);
				assert.equal(home.status, 200, log);
				assert.match(log, new RegExp(`site: ${preset} preset`), "the exported preset is the site's");
				for (const block of page.blocks) assert.ok(home.body.includes(`data-slot="${block.item}"`) || home.body.includes(`id="${block.id}"`), `${block.item} on the home page`);
				for (const section of SECTIONS[preset]!) assert.equal((await get(`${base}${section}`)).status, 200, section);
				for (const image of images.local) assert.equal((await get(`${base}/static/images/${path.basename(image.path)}`)).status, 200, image.path);
				const css = await fetch(`${base}/static/app.css`);
				assert.equal(css.status, 200);
			} finally {
				server.kill("SIGTERM");
			}
			run(path.join(ROOT, "node_modules/.bin/ui8px"), ["init", "--preset", "go"], site);
			const blocks = page.blocks.map((b) => `ui/kit/blocks/${b.item}.templ`);
			const lint = run(path.join(ROOT, "node_modules/.bin/ui8px"), ["lint", ...blocks], site);
			assert.match(lint, /Violations: 0/);
			const starter = spawnSync(path.join(ROOT, "node_modules/.bin/ui8px"), ["lint", "ui", "internal/view"], { cwd: site, encoding: "utf8" });
			console.log(`# ${preset}: ui8px lint of the starter itself (phase c): ${(String(starter.stdout).match(/Violations: \d+/) ?? ["?"])[0]}`);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
}

/**
 * The pinned Go templ starter of the templ export (ADR 0069): fastygo/starter at the commit of catalog/snapshot.config.json
 * (`templ`), the chat's overlay (catalog/templ/overlay + scripts/lib/templ-overlay.mjs: internal/page, the home screen
 * renders page.json, @source of ui/kit/blocks, images embedded), every catalog block added into ui/kit with the pinned
 * UI8Kit CLI from the templ registry, `go tool templ generate` and the stylesheet built with the pinned Tailwind CLI.
 *
 *   node scripts/templ-snapshot.mjs           network + Go: rebuild registry/templ (starter tarball, CLI, templ, Tailwind,
 *                                             then go vet and go build as a sanity check)
 *   node scripts/templ-snapshot.mjs --check   offline: every file of registry/templ/starter matches registry/templ/snapshot.json
 *
 * Outputs (generated, never edited by hand): registry/templ/starter/** and registry/templ/snapshot.json.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { applyOverlay } from "./lib/templ-overlay.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = JSON.parse(readFileSync(join(ROOT, "catalog/snapshot.config.json"), "utf8"));
const PINS = CONFIG.templ;
const CLI = CONFIG.ui8kit.cli;
const BLOCKS = CONFIG.ui8kit.blocks;
const OUT = join(ROOT, "registry/templ");
const STARTER = join(OUT, "starter");
const SNAPSHOT = join(OUT, "snapshot.json");
/** page.json the snapshot builds with (the export writes the real one). */
const PLACEHOLDER_PAGE = `${JSON.stringify({ format: "buildy.templ-page.v1", title: "", locale: "en", preset: "shop", seo: {}, blocks: [] })}\n`;

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const rel = (base, path) => relative(base, path).split("\\").join("/");

function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) out.push(...walk(path));
		else out.push(path);
	}
	return out;
}

const excluded = (path) => PINS.exclude.some((rule) => (rule.endsWith("/") ? path.startsWith(rule) : path === rule));

function run(cmd, args, cwd, env = {}) {
	execFileSync(cmd, args, { cwd, stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, CI: "1", ...env } });
}

async function download(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	return Buffer.from(await res.arrayBuffer());
}

/** The pinned Tailwind standalone CLI (linux x64, sha256 checked), cached in .cache/tailwind. */
async function tailwind() {
	if (process.platform !== "linux" || process.arch !== "x64") throw new Error("the pinned Tailwind CLI is linux x64; run the snapshot there");
	const bin = join(ROOT, ".cache/tailwind", `tailwindcss-${PINS.tailwind.version}`);
	if (!existsSync(bin) || sha(readFileSync(bin)) !== PINS.tailwind.linuxX64Sha256) {
		const data = await download(`https://github.com/tailwindlabs/tailwindcss/releases/download/${PINS.tailwind.version}/tailwindcss-linux-x64`);
		if (sha(data) !== PINS.tailwind.linuxX64Sha256) throw new Error(`tailwindcss ${PINS.tailwind.version}: sha256 ${sha(data)} != the pin`);
		mkdirSync(dirname(bin), { recursive: true });
		writeFileSync(bin, data);
	}
	chmodSync(bin, 0o755);
	return bin;
}

async function snapshot() {
	const tmp = mkdtempSync(join(tmpdir(), "templ-snapshot-"));
	try {
		const tgz = join(tmp, "starter.tgz");
		writeFileSync(tgz, await download(`https://codeload.github.com/${PINS.starter.repo}/tar.gz/${PINS.starter.commit}`));
		const dir = join(tmp, "starter");
		mkdirSync(dir);
		run("tar", ["xzf", tgz, "-C", dir, "--strip-components=1"], tmp);
		const starterLock = JSON.parse(readFileSync(join(dir, "ui/kit/ui8kit.lock.json"), "utf8"));
		applyOverlay(ROOT, dir);
		run("npx", ["--yes", CLI, "add", ...BLOCKS, "--yes"], join(dir, "ui/kit"));
		writeFileSync(join(dir, "internal/page/page.json"), PLACEHOLDER_PAGE);
		const go = { GOFLAGS: "-mod=readonly", CGO_ENABLED: "0" };
		run("go", ["tool", "templ", "generate"], dir, go);
		run("go", ["generate", "./internal/page"], dir, go);
		run(await tailwind(), ["-i", "ui/styles/app.css", "-o", "internal/web/static/app.css", "--minify"], dir);
		run("go", ["vet", "./..."], dir, go);
		run("go", ["build", "-o", join(tmp, "site"), "./cmd/site"], dir, go);
		rmSync(STARTER, { recursive: true, force: true });
		const files = {};
		const executables = [];
		for (const path of walk(dir).map((p) => rel(dir, p)).sort()) {
			if (excluded(path)) continue;
			mkdirSync(dirname(join(STARTER, path)), { recursive: true });
			cpSync(join(dir, path), join(STARTER, path));
			files[path] = sha(readFileSync(join(dir, path)));
			if (statSync(join(dir, path)).mode & 0o100) executables.push(path);
		}
		const starterBlocks = Object.values(starterLock.items).filter((item) => item.type === "registry:block").map((item) => item.name).sort();
		const goVersion = execFileSync("go", ["env", "GOVERSION"], { encoding: "utf8" }).trim();
		const doc = { format: "buildy-templ-snapshot", version: 1, starter: PINS.starter, cli: CLI, registry: PINS.registry, tailwind: PINS.tailwind.version, go: goVersion, blocks: BLOCKS, starterBlocks, executables, files };
		writeFileSync(SNAPSHOT, `${JSON.stringify(doc, null, "\t")}\n`);
		console.log(`templ snapshot: ${PINS.starter.repo}@${PINS.starter.commit.slice(0, 7)}, ${BLOCKS.length} blocks, ${Object.keys(files).length} files`);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}

function check() {
	const fail = [];
	const doc = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
	if (doc.starter?.commit !== PINS.starter.commit || doc.cli !== CLI || doc.tailwind !== PINS.tailwind.version) fail.push("registry/templ/snapshot.json pins differ from catalog/snapshot.config.json (npm run snapshot:templ)");
	if (JSON.stringify(doc.blocks) !== JSON.stringify(BLOCKS)) fail.push("registry/templ/snapshot.json blocks differ from the catalog (npm run snapshot:templ)");
	const disk = existsSync(STARTER) ? walk(STARTER).map((p) => rel(STARTER, p)) : [];
	for (const path of disk) {
		if (!doc.files[path]) fail.push(`not in registry/templ/snapshot.json: ${path}`);
		else if (sha(readFileSync(join(STARTER, path))) !== doc.files[path]) fail.push(`modified: registry/templ/starter/${path}`);
	}
	for (const path of Object.keys(doc.files)) if (!disk.includes(path)) fail.push(`missing: registry/templ/starter/${path}`);
	// the scripts the starter runs as ./scripts/… stay executable in the ZIP (git keeps the bit; Windows checkouts have none)
	for (const path of doc.executables ?? []) if (!doc.files[path]) fail.push(`executable not in the snapshot: ${path}`);
	if (process.platform !== "win32") for (const path of disk) if (Boolean(statSync(join(STARTER, path)).mode & 0o100) !== (doc.executables ?? []).includes(path)) fail.push(`executable bit differs: registry/templ/starter/${path}`);
	for (const item of BLOCKS) if (!doc.files[`ui/kit/blocks/${item}.templ`] || !doc.files[`ui/kit/blocks/${item}_templ.go`]) fail.push(`block ${item} or its generated code is missing`);
	for (const message of fail) console.error(message);
	console.log(`templ snapshot --check: ${Object.keys(doc.files).length} files: ${fail.length ? `${fail.length} problem(s)` : "all match"}`);
	return fail.length === 0;
}

if (process.argv.includes("--check")) {
	if (!check()) process.exitCode = 1;
} else {
	await snapshot();
}

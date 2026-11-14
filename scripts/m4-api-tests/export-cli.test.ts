/**
 * Export vs the real CLI (plan item 6, audit E-02): the registry files, ui8kit.config.json and ui8kit.lock.json of an exported
 * project are what `npx ui8kit init --yes --framework svelte` + `npx ui8kit add <registryItems>` write for the same items,
 * for a sample of pages (blocks of several kinds, a dashboard screen, a landing screen with a registry skin).
 *   default                the export is compared with a golden file of the CLI's output (offline, sha256 per file)
 *   UI8KIT_LIVE=1          the export is compared with the CLI run right now (network; also checks the golden file is current)
 *   UI8KIT_UPDATE=1        (with UI8KIT_LIVE=1) rewrite the golden file from the live CLI
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";
import { addScreen, catalogSnapshot, emptyPage, migratePageV1, registrySkins, screenSupport } from "../../packages/builder-core/src/index.ts";
import { CLI_CONFIG, CLI_LOCK, packZipFiles } from "../../apps/chat-web/src/lib/page-store/pack.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SNAPSHOT = path.join(ROOT, "registry/svelte");
const GOLDEN = path.join(ROOT, "scripts/m4-api-tests/fixtures/export-cli-sample.json");
const CLI = (JSON.parse(readFileSync(path.join(ROOT, "catalog/snapshot.config.json"), "utf8")) as { ui8kit: { cli: string } }).ui8kit.cli;
const NOW = "2026-11-09T00:00:00.000Z";
const LIVE = process.env.UI8KIT_LIVE === "1";

const read = async (paths: string[]) => Object.fromEntries(paths.map((file) => [file, readFileSync(path.join(SNAPSHOT, file), "utf8")]));
const sha = (text: string) => createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
const fitness = migratePageV1(JSON.parse(readFileSync(path.join(ROOT, "scripts/m4-api-tests/fixtures/fitness-session-3933dbf.json"), "utf8")).sessions[0].page.applied).page;

function screenPage(kind: "dashboard" | "landing"): PageV2 {
	const screen = catalogSnapshot.screens.find((entry) => screenSupport(entry).supported && (kind === "dashboard" ? entry.labels.section.includes("dashboard") : entry.labels.site.includes(kind) && !entry.labels.section.includes("dashboard")));
	assert.ok(screen, kind);
	const r = addScreen(emptyPage({ title: `A ${kind}`, locale: "en", now: NOW }), screen.screenId);
	assert.ok(r.ok);
	return r.page;
}

const SAMPLES: Array<{ label: string; page: PageV2; skin?: string }> = [
	{ label: "fitness page, default theme", page: fitness },
	{ label: "dashboard screen", page: screenPage("dashboard") },
	{ label: "landing screen with the first registry skin", page: screenPage("landing"), skin: registrySkins()[0]!.id }
];

const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(path.join(dir, name)).isDirectory() ? files(path.join(dir, name)).map((f) => `${name}/${f}`) : [name]));

type Fingerprint = { registryItems: string[]; files: Record<string, string>; lockItems: string[] };

async function exported(sample: (typeof SAMPLES)[number]) {
	const zip = await packZipFiles(sample.page, read, { skin: sample.skin ?? null });
	const generator = JSON.parse(zip.find((file) => file.path === "GENERATOR.json")!.content) as { registryItems: string[] };
	const manifest = JSON.parse(zip.at(-1)!.content) as { files: string[] };
	// What the CLI writes: the config, the lock and the registry files under src/ (the rest of the pack is the chat's own scaffold).
	const registryPaths = manifest.files.filter((file) => file === CLI_CONFIG || file === CLI_LOCK || (file.startsWith("src/") && !file.startsWith("src/sections/") && file !== "src/App.svelte" && file !== "src/main.ts"));
	const byPath = new Map(zip.map((file) => [file.path, file.content]));
	return { items: generator.registryItems, registry: Object.fromEntries(registryPaths.map((file) => [file, byPath.get(file)!])) };
}

const fingerprint = (items: string[], registry: Record<string, string>): Fingerprint => ({
	registryItems: items,
	files: Object.fromEntries(Object.entries(registry).filter(([file]) => file !== CLI_LOCK).map(([file, content]) => [file, sha(content)]).sort(([a], [b]) => a!.localeCompare(b!))),
	lockItems: Object.keys((JSON.parse(registry[CLI_LOCK]!) as { items: Record<string, unknown> }).items)
});

function runCli(items: string[]): Record<string, string> {
	const dir = mkdtempSync(path.join(tmpdir(), "buildy-cli-"));
	try {
		writeFileSync(path.join(dir, "package.json"), '{"name":"cli-sample","private":true,"type":"module"}\n');
		const run = (args: string[]) => {
			const r = spawnSync("npx", ["--yes", CLI, ...args], { cwd: dir, encoding: "utf8", timeout: 240_000 });
			assert.equal(r.status, 0, `ui8kit ${args.join(" ")} failed:\n${r.stdout}\n${r.stderr}`);
		};
		run(["init", "--yes", "--framework", "svelte"]);
		run(["add", ...items]);
		const out: Record<string, string> = {};
		for (const file of [CLI_CONFIG, CLI_LOCK, ...files(path.join(dir, "src")).map((f) => `src/${f}`)]) out[file] = readFileSync(path.join(dir, file), "utf8");
		return out;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

if (LIVE) {
	test(`export equals the CLI (${CLI}) run now, and the golden file is current`, async () => {
		const golden: Record<string, Fingerprint> = {};
		for (const sample of SAMPLES) {
			const { items, registry } = await exported(sample);
			const cli = runCli(items);
			const names = (reg: Record<string, string>) => Object.keys(reg).filter((file) => file !== CLI_LOCK).sort();
			assert.deepEqual(names(registry), names(cli), `${sample.label}: the same files`);
			for (const file of names(registry)) assert.equal(sha(registry[file]!), sha(cli[file]!), `${sample.label}: ${file}`);
			const lockOf = (text: string) => (JSON.parse(text) as { items: Record<string, unknown> }).items;
			assert.deepEqual(lockOf(registry[CLI_LOCK]!), lockOf(cli[CLI_LOCK]!), `${sample.label}: the lock items`);
			golden[sample.label] = fingerprint(items, registry);
		}
		if (process.env.UI8KIT_UPDATE === "1") writeFileSync(GOLDEN, `${JSON.stringify({ cli: CLI, samples: golden }, null, "\t")}\n`);
		else assert.deepEqual(JSON.parse(readFileSync(GOLDEN, "utf8")), { cli: CLI, samples: golden }, "the golden file is what the CLI writes now (UI8KIT_UPDATE=1 rewrites it)");
	});
} else {
	test(`export equals the golden output of ${CLI} (offline; UI8KIT_LIVE=1 checks it against the CLI)`, async () => {
		assert.ok(existsSync(GOLDEN), "run with UI8KIT_LIVE=1 UI8KIT_UPDATE=1 once to write the golden file");
		const golden = JSON.parse(readFileSync(GOLDEN, "utf8")) as { cli: string; samples: Record<string, Fingerprint> };
		assert.equal(golden.cli, CLI, "the golden file is for the pinned CLI");
		assert.deepEqual(Object.keys(golden.samples), SAMPLES.map((s) => s.label));
		for (const sample of SAMPLES) {
			const { items, registry } = await exported(sample);
			assert.deepEqual(fingerprint(items, registry), golden.samples[sample.label], sample.label);
		}
	});
}

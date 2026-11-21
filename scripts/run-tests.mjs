#!/usr/bin/env node
/**
 * Runs the repository's tests by group (scripts/tests.json): `node scripts/run-tests.mjs [group ...]`.
 * No argument: every group (this is `npm test`). `live`: the network tests (UI8KIT_LIVE=1). A package's own `test`
 * script runs its group (`npm test -w @buildytech/builder-core`). Fails when a test file is in no group or in two.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "scripts/tests.json"), "utf8"));
const listed = [...Object.values(manifest.groups).flat(), ...manifest.live];

const onDisk = readdirSync(join(root, manifest.dir)).filter((name) => name.endsWith(".test.ts"));
const missing = onDisk.filter((name) => !listed.includes(name));
const duplicate = listed.filter((name, index) => listed.indexOf(name) !== index);
const gone = listed.filter((name) => !onDisk.includes(name));
if (missing.length || duplicate.length || gone.length) {
	console.error(`scripts/tests.json out of step: unlisted ${missing.join(", ") || "-"}; twice ${duplicate.join(", ") || "-"}; missing on disk ${gone.join(", ") || "-"}`);
	process.exit(1);
}

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : Object.keys(manifest.groups);
const files = names.flatMap((name) => {
	const group = name === "live" ? manifest.live : manifest.groups[name];
	if (!group) {
		console.error(`unknown test group ${name}; groups: ${[...Object.keys(manifest.groups), "live"].join(", ")}`);
		process.exit(1);
	}
	return group.map((file) => `${manifest.dir}/${file}`);
});

// The compiled registry blocks (api/runtime/_render/blocks.mjs, gitignored) are built once here, before the test files
// start in parallel: a test that finds it missing builds it itself, and two such builds at once empty the folder under
// each other's import (ERR_MODULE_NOT_FOUND on a fresh checkout, as in CI).
if (!existsSync(join(root, "api/runtime/_render/blocks.mjs"))) {
	const bundle = spawnSync(process.execPath, [join(root, "scripts/build-render-bundle.mjs")], { cwd: root, stdio: "inherit" });
	if (bundle.status !== 0) process.exit(bundle.status ?? 1);
}

const run = spawnSync(
	process.execPath,
	["--experimental-strip-types", "--import", "./packages/builder-core/src/catalog/props-gate.ts", "--test", ...files],
	{ cwd: root, stdio: "inherit", env: names.includes("live") ? { ...process.env, UI8KIT_LIVE: "1" } : process.env }
);
process.exit(run.status ?? 1);

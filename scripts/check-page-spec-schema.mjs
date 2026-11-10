/**
 * Compare the vendored page-spec/v1, page-patch/v1 and session buildy:v1 schemas (packages/page-contract/schema) with the
 * published ones at https://schema.buildy.tw. Network check, not part of npm test.
 * Usage: npm run schema:check
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../packages/page-contract/schema");
let failed = false;
for (const name of ["page-spec", "page-patch", "session"]) {
	const url = `https://schema.buildy.tw/${name}.schema.json`;
	const local = readFileSync(join(dir, `${name}.schema.json`), "utf8");
	const res = await fetch(url);
	const remote = res.ok ? await res.text() : "";
	const same = res.ok && JSON.stringify(JSON.parse(remote)) === JSON.stringify(JSON.parse(local));
	console.log(`${name}: HTTP ${res.status} ${same ? "identical" : "DIFFERENT"}`);
	if (!same) failed = true;
}
process.exit(failed ? 1 : 0);

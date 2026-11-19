/** Compare vendored schemas with catalog/snapshot.config.json contract pin. --published diagnoses the deployed $id separately. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../packages/page-contract/schema");
const args = process.argv.slice(2);
if (args.length > 1 || args.some((arg) => arg !== '--published')) throw new Error('Usage: schema:check [--published]');
const { contract } = JSON.parse(readFileSync(join(dir, '../../../catalog/snapshot.config.json'), 'utf8'));
if (!contract || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(contract.repo) || !/^[a-f0-9]{40}$/.test(contract.commit) || contract.schemas !== 'public') throw new Error('Invalid immutable contract pin');
const source = args.includes('--published') ? 'https://schema.buildy.tw' : 'https://raw.githubusercontent.com/' + contract.repo + '/' + contract.commit + '/' + contract.schemas;
console.log('schema source: ' + source);
let failed = false;
for (const name of ["page-spec", "page-patch", "page-spec-v2", "page-patch-v2", "session", "collection", "block-contract"]) {
	const url = `${source}/${name}.schema.json`;
	const local = readFileSync(join(dir, `${name}.schema.json`), "utf8");
	const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
	const remote = res.ok ? await res.text() : "";
	const same = res.ok && JSON.stringify(JSON.parse(remote)) === JSON.stringify(JSON.parse(local));
	console.log(`${name}: HTTP ${res.status} ${same ? "identical" : "DIFFERENT"}`);
	if (!same) failed = true;
}
process.exit(failed ? 1 : 0);

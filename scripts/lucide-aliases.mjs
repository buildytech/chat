// Writes packages/builder-core/src/catalog/lucide-aliases.json: the old and alternate names of the pinned Lucide icons
// (lucide renamed smile to face-slightly-smiling, home to house, check-circle to circle-check; models still write the old
// names). Read from the aliases of the `lucide` package (dist/esm/iconsAndAliases.mjs): key = the alias lowercased without
// separators, value = the icon name the registry's lucideIcon enum has. `node scripts/lucide-aliases.mjs` writes, `--check` fails when the file differs.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = `${ROOT}packages/builder-core/src/catalog/lucide-aliases.json`;
const key = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function build() {
	const dir = join(dirname(createRequire(`${ROOT}apps/chat-web/package.json`).resolve("lucide/package.json")), "dist/esm");
	const names = readdirSync(join(dir, "icons")).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4));
	const exported = await import(pathToFileURL(join(dir, "iconsAndAliases.mjs")).href);
	const byNode = new Map();
	for (const name of names) byNode.set((await import(pathToFileURL(join(dir, "icons", `${name}.mjs`)).href)).default, name);
	const out = {};
	for (const [alias, node] of Object.entries(exported)) {
		const icon = byNode.get(node);
		if (icon && key(alias) !== key(icon)) out[key(alias)] = icon;
	}
	return `${JSON.stringify(Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1))), null, 1)}\n`;
}

const text = await build();
if (process.argv.includes("--check")) {
	if (readFileSync(OUT, "utf8") !== text) {
		console.error("lucide-aliases.json is stale: run node scripts/lucide-aliases.mjs and commit it");
		process.exit(1);
	}
	console.log("lucide aliases current");
} else {
	writeFileSync(OUT, text);
	console.log(`wrote ${OUT.replace(ROOT, "")}`);
}

/**
 * The vendored schemas (packages/page-contract/schema) are byte-identical to the installed @ui8kit/contract (0.5.0,
 * offline; `npm run schema:check` compares them with the pinned commit online), and the dependency-free session check
 * agrees with the contract's own fixtures: buildy:v2 files open, a buildy:v1 export is refused.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseSessionFile } from "../../apps/chat-web/src/lib/browser/session-file.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const vendored = join(root, "packages/page-contract/schema");
const contract = dirname(createRequire(join(root, "packages/page-contract/package.json")).resolve("@ui8kit/contract/package.json"));
const pkg = JSON.parse(readFileSync(join(contract, "package.json"), "utf8")) as { version: string };

test("vendored schemas are byte-identical to the installed @ui8kit/contract", () => {
	assert.match(pkg.version, /^0\.5\./);
	const names = readdirSync(vendored).filter((f) => f.endsWith(".schema.json")).sort();
	assert.deepEqual(names, ["block-contract.schema.json", "page-patch-v2.schema.json", "page-patch.schema.json", "page-spec-v2.schema.json", "page-spec.schema.json", "session-v2.schema.json"]);
	for (const name of names) assert.equal(readFileSync(join(vendored, name), "utf8"), readFileSync(join(contract, "schemas", name), "utf8"), name);
});

test("the contract's buildy:v2 fixtures open; its buildy:v1 export is refused before anything is read", () => {
	const dir = join(contract, "fixtures/session-v2");
	for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
		const parsed = parseSessionFile(readFileSync(join(dir, f), "utf8"));
		assert.ok(parsed.ok, `${f}: ${JSON.stringify(parsed)}`);
	}
	const v1 = parseSessionFile(readFileSync(join(contract, "fixtures/session/exported-chat.json"), "utf8"));
	assert.equal(v1.ok, false);
	if (!v1.ok) assert.ok(["schema_invalid", "page_v1_unsupported"].includes(v1.code), v1.code);
});

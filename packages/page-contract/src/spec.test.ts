import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PAGE_BLOCK_KINDS, PAGE_COPY_KEYS, PAGE_LIMITS, PAGE_STATUSES } from "./types.ts";
import { PageContractError, parsePage } from "./validate.ts";
import {
	PAGE_PATCH_SCHEMA_URL,
	PAGE_SLOTS,
	PAGE_SPEC_SCHEMA_URL,
	pagePatchIssues,
	pagePatchSchema,
	pageSpecDefIssues,
	pageSpecIssues,
	pageSpecSchema,
	parsePageSpec
} from "./spec.ts";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => JSON.parse(readFileSync(join(here, rel), "utf8"));
const fixture = read("../fixtures/north-harbor-kitchen.json");
const spec = read("../fixtures/conformance-cases.json");
const PROGRAM = new Set<string>((pageSpecSchema as { "x-program-checks": string[] })["x-program-checks"]);

type Seg = string | number;
/** Conformance cases are untyped JSON edited by path: the type is what `JSON.parse` returns. */
type Json = ReturnType<typeof JSON.parse>;
function applyCase(c: Json): Json {
	const doc = structuredClone(fixture);
	for (const op of c.set ?? []) {
		let cur: Json = doc;
		for (const seg of (op.path as Seg[]).slice(0, -1)) cur = cur[seg];
		cur[op.path.at(-1)] = op.value;
	}
	if (c.repeatTitle) doc.title = "n".repeat(c.repeatTitle);
	if (c.repeatSlug) doc.slug = "a".repeat(c.repeatSlug);
	for (let i = 0; i < (c.padBlocks ?? 0); i++) {
		doc.layout.blocks.push({ id: `block-extra-${i}`, kind: "feature", title: "Extra", summary: "Padding block for the count limit." });
	}
	if (c.nestDepth) {
		const nest = (d: number): Json => ({ id: `block-d${d}`, kind: "feature", title: "Nested", summary: "Depth probe.", ...(d > 1 ? { children: [nest(d - 1)] } : {}) });
		doc.layout.blocks = [nest(c.nestDepth)];
	}
	return doc;
}

test("vendored schemas are the published page-spec/v1 and page-patch/v1", () => {
	assert.equal(pageSpecSchema.$id, PAGE_SPEC_SCHEMA_URL);
	assert.equal(pagePatchSchema.$id, PAGE_PATCH_SCHEMA_URL);
	assert.equal(pageSpecSchema["x-page-spec-profile"], "page-spec/v1");
	assert.deepEqual(pageSpecSchema.$defs.kind.enum, [...PAGE_BLOCK_KINDS]);
	assert.deepEqual(Object.keys(pageSpecSchema.$defs.copy.properties), [...PAGE_COPY_KEYS]);
	assert.deepEqual(pageSpecSchema.$defs.page.properties.status.enum, [...PAGE_STATUSES]);
	for (const [key, value] of Object.entries(PAGE_LIMITS)) {
		assert.equal((pageSpecSchema["x-limits"] as Record<string, number>)[key], value, key);
	}
	assert.deepEqual(Object.keys(PAGE_SLOTS).sort(), [...PAGE_BLOCK_KINDS].sort());
});

test("the North Harbor fixture and a store blob pass the schema", () => {
	assert.deepEqual(pageSpecIssues(fixture), []);
	assert.equal(parsePageSpec(fixture).id, "page-home");
	const store = { version: 1, pages: { a: { applied: fixture, candidate: null, selectedBlockId: null, revision: 1 } } };
	assert.deepEqual(pageSpecDefIssues(store, "store"), []);
	assert.notDeepEqual(pageSpecDefIssues({ version: 1, pages: { a: { applied: { id: "x" } } } }, "store"), []);
});

for (const c of spec.cases) {
	test(`schema agrees with parsePage: ${c.name}`, () => {
		const input = applyCase(c);
		const issues = pageSpecIssues(input);
		let parseCode: string | null = null;
		try {
			parsePage(input);
		} catch (err) {
			parseCode = err instanceof PageContractError ? err.code : "error";
		}
		if (!parseCode) assert.deepEqual(issues, [], "parsePage accepts, schema must accept");
		else if (!PROGRAM.has(parseCode)) assert.ok(issues.length > 0, `parsePage ${parseCode}, schema must reject`);
		if (c.code && !(c.parser === "draft" && c.code === "invalid_status")) {
			assert.throws(() => parsePageSpec(input), (err: unknown) => err instanceof PageContractError);
		}
	});
}

test("page-patch schema accepts ops and rejects caller layouts and markup", () => {
	assert.deepEqual(pagePatchIssues({ ops: [{ op: "set", blockId: "block-hero", field: "headline", value: "Hi" }] }), []);
	assert.deepEqual(pagePatchIssues({ ops: [{ op: "move", blockId: "block-cta", to: 0 }, { op: "set", blockId: "block-hero", field: "eyebrow", value: null }] }), []);
	assert.notDeepEqual(pagePatchIssues({ ops: [] }), []);
	assert.notDeepEqual(pagePatchIssues({ ops: [{ op: "set", blockId: "block-hero", field: "lede", value: "<b>x</b>" }] }), []);
	assert.notDeepEqual(pagePatchIssues({ layout: { version: 1, blocks: [] }, ops: [{ op: "remove", blockId: "block-cta" }] }), []);
	assert.notDeepEqual(pagePatchIssues({ ops: [{ op: "add", kind: "metric" }] }), []);
	assert.notDeepEqual(pagePatchIssues({ ops: [{ op: "set", blockId: "block-cta", field: "action", value: "java\nscript:alert(1)" }] }), []);
});

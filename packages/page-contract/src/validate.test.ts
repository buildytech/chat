import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PAGE_BLOCK_KINDS, PAGE_COPY_KEYS, PAGE_LAYOUT_VERSION, PAGE_LIMITS, PAGE_STATUSES } from "./types.ts";
import { PageContractError, parseDraftPage, parsePage } from "./validate.ts";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");
const fixture = JSON.parse(readFileSync(join(fixturesDir, "north-harbor-kitchen.json"), "utf8")) as unknown;
const spec = JSON.parse(readFileSync(join(fixturesDir, "conformance-cases.json"), "utf8")) as ConformanceSpec;

type PathSeg = string | number;
type ConformanceCase = {
	name: string;
	parser?: "page" | "draft";
	code?: string;
	set?: { path: PathSeg[]; value: unknown }[];
	padBlocks?: number;
	nestDepth?: number;
	repeatTitle?: number;
	repeatSlug?: number;
};
type ConformanceSpec = {
	constants: {
		layoutVersion: number;
		blockKinds: string[];
		copyKeys: string[];
		statuses: string[];
		limits: Record<string, number>;
	};
	validDraft: string;
	cases: ConformanceCase[];
};

function clone(): Record<string, unknown> {
	return JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>;
}

function setPath(doc: Record<string, unknown>, path: PathSeg[], value: unknown): void {
	let cursor: unknown = doc;
	for (let i = 0; i < path.length - 1; i++) {
		const seg = path[i]!;
		if (typeof cursor !== "object" || cursor === null) {
			throw new Error(`cannot walk ${path.join(".")}`);
		}
		cursor = (cursor as Record<string, unknown>)[String(seg)];
	}
	const last = path[path.length - 1]!;
	(cursor as Record<string, unknown>)[String(last)] = value;
}

function nest(depth: number): Record<string, unknown> {
	const block: Record<string, unknown> = {
		id: `block-d${depth}`,
		kind: "feature",
		title: "Nested",
		summary: "Depth probe."
	};
	if (depth > 1) block.children = [nest(depth - 1)];
	return block;
}

function applyCase(c: ConformanceCase): unknown {
	const doc = clone();
	for (const op of c.set ?? []) setPath(doc, op.path, op.value);
	if (c.repeatTitle) doc.title = "n".repeat(c.repeatTitle);
	if (c.repeatSlug) doc.slug = "a".repeat(c.repeatSlug);
	if (c.padBlocks) {
		const layout = doc.layout as Record<string, unknown>;
		const blocks = layout.blocks as unknown[];
		for (let i = 0; i < c.padBlocks; i++) {
			blocks.push({
				id: `block-extra-${i}`,
				kind: "feature",
				title: "Extra",
				summary: "Padding block for the count limit."
			});
		}
	}
	if (c.nestDepth) {
		(doc.layout as Record<string, unknown>).blocks = [nest(c.nestDepth)];
	}
	return doc;
}

test("shared constants match the TypeScript contract", () => {
	assert.equal(spec.constants.layoutVersion, PAGE_LAYOUT_VERSION);
	assert.deepEqual(spec.constants.blockKinds, [...PAGE_BLOCK_KINDS]);
	assert.deepEqual(spec.constants.copyKeys, [...PAGE_COPY_KEYS]);
	assert.deepEqual(spec.constants.statuses, [...PAGE_STATUSES]);
	assert.equal(spec.constants.limits.maxBlocks, PAGE_LIMITS.maxBlocks);
	assert.equal(spec.constants.limits.maxDepth, PAGE_LIMITS.maxDepth);
	assert.equal(spec.constants.limits.maxJsonChars, PAGE_LIMITS.maxJsonChars);
	assert.equal(spec.validDraft, "north-harbor-kitchen.json");
});

test("published and other PagePort statuses remain valid for parsePage", () => {
	for (const status of spec.constants.statuses) {
		const page = clone();
		page.status = status;
		assert.equal(parsePage(page).status, status);
	}
});

for (const c of spec.cases) {
	test(`conformance: ${c.name}`, () => {
		const input = applyCase(c);
		const parse = c.parser === "draft" ? parseDraftPage : parsePage;
		if (c.code) {
			assert.throws(
				() => parse(input),
				(err: unknown) => {
					assert.ok(err instanceof PageContractError, `expected PageContractError, got ${String(err)}`);
					assert.equal(err.code, c.code);
					return true;
				}
			);
			return;
		}
		const page = parse(input);
		assert.equal(page.id, "page-home");
		assert.equal(page.layout.version, 1);
	});
}

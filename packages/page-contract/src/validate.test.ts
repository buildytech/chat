import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PAGE_LIMITS, PAGE_STATUSES } from "./types.ts";
import { PageContractError, parseDraftPage, parsePage } from "./validate.ts";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/north-harbor-kitchen.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as unknown;

function clone(): Record<string, unknown> {
	return JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>;
}

function layoutOf(page: Record<string, unknown>): Record<string, unknown> {
	return page.layout as Record<string, unknown>;
}

function blocksOf(page: Record<string, unknown>): Record<string, unknown>[] {
	return layoutOf(page).blocks as Record<string, unknown>[];
}

function expectCode(code: string, input: unknown): void {
	assert.throws(
		() => parsePage(input),
		(err: unknown) => {
			assert.ok(err instanceof PageContractError, `expected PageContractError, got ${String(err)}`);
			assert.equal(err.code, code);
			return true;
		}
	);
}

test("existing fixture is a valid draft Page", () => {
	const page = parseDraftPage(fixture);
	assert.equal(page.id, "page-home");
	assert.equal(page.slug, "home");
	assert.equal(page.status, "draft");
	assert.equal(page.layout.version, 1);
	assert.equal(page.layout.blocks.length, 7);
	assert.equal(page.layout.blocks[0]?.children?.length, 3);
});

test("published and other PagePort statuses remain valid", () => {
	for (const status of PAGE_STATUSES) {
		const page = clone();
		page.status = status;
		assert.equal(parsePage(page).status, status);
	}
});

test("parseDraftPage rejects non-draft status", () => {
	const page = clone();
	page.status = "published";
	assert.throws(
		() => parseDraftPage(page),
		(err: unknown) => {
			assert.ok(err instanceof PageContractError);
			assert.equal(err.code, "invalid_status");
			return true;
		}
	);
});

test("malformed ids are rejected", () => {
	for (const id of ["Block-Nav", "1hero", "block_nav", "block.nav", "a';alert(1)", "block id"]) {
		const page = clone();
		blocksOf(page)[1]!.id = id;
		expectCode("invalid_id", page);
	}
});

test("duplicate ids are rejected", () => {
	const page = clone();
	blocksOf(page)[1]!.id = "block-nav";
	expectCode("duplicate_id", page);
});

test("unsupported kinds are rejected", () => {
	const page = clone();
	blocksOf(page)[1]!.kind = "carousel";
	expectCode("unsupported_kind", page);
});

test("unexpected keys are rejected", () => {
	const extraPage = clone();
	extraPage.promo = "off";
	expectCode("unexpected_key", extraPage);

	const extraLayout = clone();
	layoutOf(extraLayout).theme = "dark";
	expectCode("unexpected_key", extraLayout);

	const extraBlock = clone();
	blocksOf(extraBlock)[1]!.href = "https://example.com";
	expectCode("unexpected_key", extraBlock);

	const extraCopy = clone();
	(blocksOf(extraCopy)[1]!.copy as Record<string, unknown>).promo = "10%";
	expectCode("unexpected_key", extraCopy);
});

test("invalid slugs are rejected", () => {
	for (const slug of ["Home", "home/utm", "utm_source", "home--x", "-home", "home-", "", "a".repeat(49)]) {
		const page = clone();
		page.slug = slug;
		const code = slug.length > PAGE_LIMITS.maxSlugLength ? "too_long" : slug === "" ? "empty_required" : "invalid_slug";
		expectCode(code, page);
	}
});

test("malicious URL schemes are rejected", () => {
	const js = clone();
	(blocksOf(js)[1]!.copy as Record<string, unknown>).action = "javascript:alert(1)";
	expectCode("unsafe_url", js);

	const spaced = clone();
	(blocksOf(spaced)[1]!.copy as Record<string, unknown>).action = "java\nscript:alert(1)";
	expectCode("unsafe_url", spaced);

	const dataUrl = clone();
	(blocksOf(dataUrl)[5]!.copy as Record<string, unknown>).lede = "data:text/html,hi";
	expectCode("unsafe_url", dataUrl);

	const fileUrl = clone();
	(blocksOf(fileUrl)[6]!.copy as Record<string, unknown>).contact = "file:///etc/passwd";
	expectCode("unsafe_url", fileUrl);

	const vbs = clone();
	(blocksOf(vbs)[1]!.copy as Record<string, unknown>).headline = "vbscript:msgbox(1)";
	expectCode("unsafe_url", vbs);
});

test("overlarge payloads are rejected", () => {
	const huge = clone();
	huge.title = "n".repeat(PAGE_LIMITS.maxJsonChars);
	expectCode("too_large", huge);

	const many = clone();
	const extras = Array.from({ length: PAGE_LIMITS.maxBlocks }, (_, index) => ({
		id: `block-extra-${index}`,
		kind: "feature",
		title: "Extra",
		summary: "Padding block for the count limit."
	}));
	layoutOf(many).blocks = [...blocksOf(many), ...extras];
	expectCode("too_many_blocks", many);
});

test("over-deep trees are rejected", () => {
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
	const page = clone();
	layoutOf(page).blocks = [nest(PAGE_LIMITS.maxDepth + 1)];
	expectCode("too_deep", page);
});

test("unsupported schema versions are rejected", () => {
	const v2 = clone();
	layoutOf(v2).version = 2;
	expectCode("unsupported_version", v2);

	const v0 = clone();
	layoutOf(v0).version = 0;
	expectCode("unsupported_version", v0);
});

test("executable markup in copy is rejected", () => {
	const html = clone();
	(blocksOf(html)[1]!.copy as Record<string, unknown>).lede = "<script>alert(1)</script>";
	expectCode("unsafe_text", html);

	const latte = clone();
	(blocksOf(latte)[1]!.copy as Record<string, unknown>).headline = "{define #pwn}";
	expectCode("unsafe_text", latte);
});

test("https URLs in copy remain valid", () => {
	const page = clone();
	(blocksOf(page)[6]!.copy as Record<string, unknown>).contact = "https://northharbor.example/reserve";
	assert.equal(parsePage(page).layout.blocks[6]?.copy?.contact, "https://northharbor.example/reserve");
});

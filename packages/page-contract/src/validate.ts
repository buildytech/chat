import {
	PAGE_BLOCK_KINDS,
	PAGE_COPY_KEYS,
	PAGE_LAYOUT_VERSION,
	PAGE_LIMITS,
	PAGE_STATUSES,
	type Page,
	type PageBlock,
	type PageBlockCopy,
	type PageBlockKind,
	type PageCopyKey,
	type PageLayout,
	type PageSeo,
	type PageStatus
} from "./types.ts";

export class PageContractError extends Error {
	readonly code: string;
	readonly path: string;

	constructor(code: string, path: string, message: string) {
		super(`${code} at ${path}: ${message}`);
		this.name = "PageContractError";
		this.code = code;
		this.path = path;
	}
}

const PAGE_KEYS = new Set([
	"id",
	"slug",
	"status",
	"title",
	"layout",
	"seo",
	"locale",
	"createdAt",
	"updatedAt"
]);
const LAYOUT_KEYS = new Set(["version", "blocks"]);
const BLOCK_KEYS = new Set(["id", "kind", "title", "summary", "copy", "children"]);
const SEO_KEYS = new Set(["title", "description"]);
const COPY_KEY_SET = new Set<string>(PAGE_COPY_KEYS);
const KIND_SET = new Set<string>(PAGE_BLOCK_KINDS);
const STATUS_SET = new Set<string>(PAGE_STATUSES);

const ID_PATTERN = /^[a-z][a-z0-9-]{0,62}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ALLOWED_URL_SCHEMES = new Set(["http:", "https:", "mailto:"]);
const DANGEROUS_URL_SCHEMES = ["javascript:", "data:", "vbscript:", "file:"] as const;
const MARKUP_PATTERN = /[<>{}]|<\?/;
const URL_SHAPED_AT_START = /^[a-z][a-z0-9+.-]*:\/\//;

function fail(code: string, path: string, message: string): never {
	throw new PageContractError(code, path, message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function asObject(value: unknown, path: string): Record<string, unknown> {
	if (!isPlainObject(value)) fail("invalid_type", path, "expected object");
	return value;
}

function assertOnlyKeys(obj: Record<string, unknown>, allowed: ReadonlySet<string>, path: string): void {
	for (const key of Object.keys(obj)) {
		if (!allowed.has(key)) fail("unexpected_key", path, `unexpected key "${key}"`);
	}
}

function requirePresent(obj: Record<string, unknown>, key: string, path: string): unknown {
	if (!(key in obj)) fail("missing_field", path, `missing "${key}"`);
	return obj[key];
}

function asString(value: unknown, path: string): string {
	if (typeof value !== "string") fail("invalid_type", path, "expected string");
	return value;
}

function assertPlainText(value: string, path: string): void {
	if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) {
		fail("unsafe_text", path, "control characters are not allowed");
	}
	if (MARKUP_PATTERN.test(value)) {
		fail("unsafe_text", path, "markup or template syntax is not allowed");
	}
}

/**
 * Injection: reject javascript/data/vbscript/file even when whitespace is used to hide the scheme.
 * URL-shaped values: scheme + "://" (http/https only) or mailto:. Prose with a colon is not a URL.
 */
function assertSafeUrlPolicy(value: string, path: string): void {
	const collapsed = value.replace(/[\u0000-\u0020]/g, "").toLowerCase();
	for (const scheme of DANGEROUS_URL_SCHEMES) {
		if (collapsed.startsWith(scheme)) {
			fail("unsafe_url", path, `scheme "${scheme}" is not allowed`);
		}
	}
	const trimmed = value.trim().toLowerCase();
	if (trimmed.startsWith("mailto:")) return;
	const urlShaped = URL_SHAPED_AT_START.exec(trimmed);
	if (!urlShaped) return;
	const scheme = urlShaped[0].slice(0, -2);
	if (!ALLOWED_URL_SCHEMES.has(scheme)) {
		fail("unsafe_url", path, `scheme "${scheme}" is not allowed`);
	}
}

function parseBoundedText(
	value: unknown,
	path: string,
	maxLength: number,
	options: { required?: boolean; pattern?: RegExp; patternCode?: string } = {}
): string {
	const text = asString(value, path);
	if (options.required && text.trim() === "") {
		fail("empty_required", path, "must be non-empty");
	}
	if (text.length > maxLength) fail("too_long", path, `exceeds ${maxLength} characters`);
	assertPlainText(text, path);
	assertSafeUrlPolicy(text, path);
	if (options.pattern && !options.pattern.test(text)) {
		fail(options.patternCode ?? "invalid_type", path, "value does not match required pattern");
	}
	return text;
}

function parseId(value: unknown, path: string, seen: Set<string>): string {
	const id = parseBoundedText(value, path, PAGE_LIMITS.maxIdLength, {
		required: true,
		pattern: ID_PATTERN,
		patternCode: "invalid_id"
	});
	if (seen.has(id)) fail("duplicate_id", path, `duplicate id "${id}"`);
	seen.add(id);
	return id;
}

function parseCopy(value: unknown, path: string): PageBlockCopy {
	const obj = asObject(value, path);
	assertOnlyKeys(obj, COPY_KEY_SET, path);
	const copy: PageBlockCopy = {};
	for (const key of PAGE_COPY_KEYS) {
		if (!(key in obj)) continue;
		copy[key] = parseBoundedText(obj[key], `${path}.${key}`, PAGE_LIMITS.maxCopyLength);
	}
	return copy;
}

function parseBlock(
	value: unknown,
	path: string,
	depth: number,
	seen: Set<string>,
	counts: { blocks: number }
): PageBlock {
	if (depth > PAGE_LIMITS.maxDepth) {
		fail("too_deep", path, `tree deeper than ${PAGE_LIMITS.maxDepth}`);
	}
	counts.blocks += 1;
	if (counts.blocks > PAGE_LIMITS.maxBlocks) {
		fail("too_many_blocks", path, `more than ${PAGE_LIMITS.maxBlocks} blocks`);
	}

	const obj = asObject(value, path);
	assertOnlyKeys(obj, BLOCK_KEYS, path);

	const id = parseId(requirePresent(obj, "id", path), `${path}.id`, seen);
	const kindRaw = asString(requirePresent(obj, "kind", path), `${path}.kind`);
	if (!KIND_SET.has(kindRaw)) {
		fail("unsupported_kind", `${path}.kind`, `unsupported block kind "${kindRaw}"`);
	}
	const kind = kindRaw as PageBlockKind;
	const title = parseBoundedText(requirePresent(obj, "title", path), `${path}.title`, PAGE_LIMITS.maxTitleLength, {
		required: true
	});
	const summary = parseBoundedText(
		requirePresent(obj, "summary", path),
		`${path}.summary`,
		PAGE_LIMITS.maxSummaryLength,
		{ required: true }
	);

	const block: PageBlock = { id, kind, title, summary };

	if ("copy" in obj) {
		block.copy = parseCopy(obj.copy, `${path}.copy`);
	}
	if ("children" in obj) {
		if (!Array.isArray(obj.children)) fail("invalid_type", `${path}.children`, "expected array");
		block.children = obj.children.map((child, index) =>
			parseBlock(child, `${path}.children[${index}]`, depth + 1, seen, counts)
		);
	}
	return block;
}

function parseSeo(value: unknown, path: string): PageSeo {
	const obj = asObject(value, path);
	assertOnlyKeys(obj, SEO_KEYS, path);
	const seo: PageSeo = {};
	if ("title" in obj) {
		seo.title = parseBoundedText(obj.title, `${path}.title`, PAGE_LIMITS.maxSeoLength);
	}
	if ("description" in obj) {
		seo.description = parseBoundedText(obj.description, `${path}.description`, PAGE_LIMITS.maxSeoLength);
	}
	return seo;
}

function parseLayout(value: unknown, path: string, seen: Set<string>): PageLayout {
	const obj = asObject(value, path);
	assertOnlyKeys(obj, LAYOUT_KEYS, path);
	const version = requirePresent(obj, "version", path);
	if (typeof version !== "number" || !Number.isInteger(version)) {
		fail("invalid_type", `${path}.version`, "expected integer");
	}
	if (version !== PAGE_LAYOUT_VERSION) {
		fail("unsupported_version", `${path}.version`, `unsupported layout.version ${String(version)}`);
	}
	const blocksRaw = requirePresent(obj, "blocks", path);
	if (!Array.isArray(blocksRaw)) fail("invalid_type", `${path}.blocks`, "expected array");
	const counts = { blocks: 0 };
	const blocks = blocksRaw.map((block, index) =>
		parseBlock(block, `${path}.blocks[${index}]`, 1, seen, counts)
	);
	return { version: PAGE_LAYOUT_VERSION, blocks };
}

/**
 * Strict runtime parse of an unknown Store / adapter payload into Page.
 * Reconstructs a plain object so unknown keys cannot leak through.
 */
export function parsePage(input: unknown): Page {
	if (typeof input === "string" && input.length > PAGE_LIMITS.maxJsonChars) {
		fail("too_large", "$", "payload exceeds size limit");
	}
	let encoded: string;
	try {
		encoded = JSON.stringify(input);
	} catch {
		fail("invalid_type", "$", "value is not JSON-serializable");
	}
	if (encoded.length > PAGE_LIMITS.maxJsonChars) {
		fail("too_large", "$", "payload exceeds size limit");
	}

	const obj = asObject(input, "$");
	assertOnlyKeys(obj, PAGE_KEYS, "$");

	const seen = new Set<string>();
	const id = parseId(requirePresent(obj, "id", "$"), "id", seen);
	const slug = parseBoundedText(requirePresent(obj, "slug", "$"), "slug", PAGE_LIMITS.maxSlugLength, {
		required: true,
		pattern: SLUG_PATTERN,
		patternCode: "invalid_slug"
	});
	const statusRaw = asString(requirePresent(obj, "status", "$"), "status");
	if (!STATUS_SET.has(statusRaw)) {
		fail("invalid_status", "status", `unsupported status "${statusRaw}"`);
	}
	const status = statusRaw as PageStatus;
	const title = parseBoundedText(requirePresent(obj, "title", "$"), "title", PAGE_LIMITS.maxTitleLength, {
		required: true
	});
	const layout = parseLayout(requirePresent(obj, "layout", "$"), "layout", seen);
	const seo = parseSeo(requirePresent(obj, "seo", "$"), "seo");
	const locale = parseBoundedText(requirePresent(obj, "locale", "$"), "locale", PAGE_LIMITS.maxLocaleLength, {
		required: true,
		pattern: LOCALE_PATTERN,
		patternCode: "invalid_locale"
	});
	const createdAt = parseBoundedText(requirePresent(obj, "createdAt", "$"), "createdAt", 40, {
		required: true,
		pattern: DATETIME_PATTERN,
		patternCode: "invalid_datetime"
	});
	const updatedAt = parseBoundedText(requirePresent(obj, "updatedAt", "$"), "updatedAt", 40, {
		required: true,
		pattern: DATETIME_PATTERN,
		patternCode: "invalid_datetime"
	});

	return { id, slug, status, title, layout, seo, locale, createdAt, updatedAt };
}

/** Ordinary draft creation: same Page contract, status must be draft. */
export function parseDraftPage(input: unknown): Page {
	const page = parsePage(input);
	if (page.status !== "draft") {
		fail("invalid_status", "status", 'ordinary draft creation requires status "draft"');
	}
	return page;
}

export function isPage(input: unknown): input is Page {
	try {
		parsePage(input);
		return true;
	} catch {
		return false;
	}
}

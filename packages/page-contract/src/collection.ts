/**
 * Collection profile buildy-collection:v1, published by @ui8kit/contract (https://schema.buildy.tw/collection.schema.json):
 * Stock screens and block variants a person picked on Stock and hands to BuildY (docs/collection-intake.md of the
 * contract). Vendored in ../schema (byte-identical to the contract commit of PAGE_SPEC_SCHEMA_SOURCE). Pure: decode,
 * schema, program checks. The split against the catalog snapshot lives in builder-core (collection.ts).
 */
import collectionSchema from "../schema/collection.schema.json" with { type: "json" };
import { SchemaRegistry, type SchemaIssue } from "./json-schema.ts";

export const COLLECTION_SCHEMA_URL = "https://schema.buildy.tw/collection.schema.json";
export const COLLECTION_FORMAT = "buildy-collection:v1" as const;
/** Longest Open in BuildY link Stock sends; above it Stock offers the file instead (intake spec section 1). */
export const COLLECTION_MAX_LINK = 8000;
/** Most decoded bytes the chat accepts from `?collection=` (intake spec section 2). */
export const COLLECTION_MAX_BYTES = 65536;
export const COLLECTION_LIMITS = (collectionSchema as { "x-limits": { maxItems: number; maxTitleLength: number; maxNoteLength: number } })["x-limits"];

export type CollectionScreenItem = { kind: "screen"; id: string; title?: string; note?: string };
export type CollectionBlockItem = { kind: "block"; id: string; variant?: string; registry?: string; title?: string; note?: string };
export type CollectionItem = CollectionScreenItem | CollectionBlockItem;
export type CollectionDoc = {
	$schema?: string;
	format: typeof COLLECTION_FORMAT;
	id: string;
	title: string;
	createdAt: string;
	updatedAt?: string;
	source?: { app: string; url?: string; version?: string };
	pins: { stock: { repo: string; assetsDigest: string; contentCommit?: string }; registry?: { url: string; sourceCommit?: string } };
	skin?: string | null;
	items: CollectionItem[];
};

const registry = new SchemaRegistry();
registry.add(collectionSchema as Record<string, unknown>);

export { collectionSchema };

/** The registry with the collection schema, for schemas that $ref its items (session 1.3.0 `collection`). */
export function addCollectionSchema(target: SchemaRegistry): void {
	target.add(collectionSchema as Record<string, unknown>);
}

/** Schema issues of a collection document. Empty = the shape is valid; run collectionProgramIssues next. */
export function collectionIssues(input: unknown): SchemaIssue[] {
	return registry.check(input, COLLECTION_SCHEMA_URL);
}

/** The Stock asset id of an item: the screen id, or `block.<name>/<variant>` (`block.<name>` without a variant). */
export function collectionAssetId(item: CollectionItem): string {
	return item.kind === "block" && item.variant ? `${item.id}/${item.variant}` : item.id;
}

/** x-program-checks after the schema: `empty_collection`, `duplicate_item` (same kind, id and variant). */
export function collectionProgramIssues(doc: Pick<CollectionDoc, "items">): SchemaIssue[] {
	const out: SchemaIssue[] = [];
	if (!doc.items.length) out.push({ path: "$.items", keyword: "empty_collection" });
	const seen = new Set<string>();
	doc.items.forEach((item, index) => {
		const key = `${item.kind}:${collectionAssetId(item)}`;
		if (seen.has(key)) out.push({ path: `$.items[${index}]`, keyword: "duplicate_item" });
		seen.add(key);
	});
	return out;
}

export type CollectionParse = { ok: true; doc: CollectionDoc } | { ok: false; code: "collection_decode" | "collection_too_large" | "collection_json" | "collection_schema" | "collection_program"; issues: SchemaIssue[] };

/** Check a collection document (object or JSON text): schema, then program checks. Nothing partial on failure. */
export function parseCollection(input: unknown): CollectionParse {
	let doc = input;
	if (typeof input === "string") {
		try {
			doc = JSON.parse(input);
		} catch {
			return { ok: false, code: "collection_json", issues: [{ path: "$", keyword: "json" }] };
		}
	}
	const schema = collectionIssues(doc);
	if (schema.length) return { ok: false, code: "collection_schema", issues: schema };
	const program = collectionProgramIssues(doc as CollectionDoc);
	if (program.length) return { ok: false, code: "collection_program", issues: program };
	return { ok: true, doc: doc as CollectionDoc };
}

/** base64url (RFC 4648 section 5, padding optional) to bytes, or null when it is not base64url. */
function base64UrlBytes(value: string): Uint8Array | null {
	if (!/^[A-Za-z0-9_-]*={0,2}$/.test(value)) return null;
	const b64 = value.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
	if (b64.length % 4 === 1) return null;
	try {
		const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
		const out = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
		return out;
	} catch {
		return null;
	}
}

/** Decode the `?collection=` payload (base64url of the UTF-8 JSON), refuse more than COLLECTION_MAX_BYTES, then check it. */
export function decodeCollectionParam(value: string): CollectionParse {
	const bytes = base64UrlBytes(value.trim());
	if (!bytes || !bytes.length) return { ok: false, code: "collection_decode", issues: [{ path: "$", keyword: "base64url" }] };
	if (bytes.length > COLLECTION_MAX_BYTES) return { ok: false, code: "collection_too_large", issues: [{ path: "$", keyword: "maxBytes" }] };
	let text: string;
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return { ok: false, code: "collection_decode", issues: [{ path: "$", keyword: "utf8" }] };
	}
	return parseCollection(text);
}

/** True when a parsed JSON value claims the collection format (file import picks the reader by `format`). */
export function isCollectionDoc(value: unknown): boolean {
	return Boolean(value && typeof value === "object" && (value as { format?: unknown }).format === COLLECTION_FORMAT);
}

/**
 * Collection profile buildy-collection:v1 (https://schema.buildy.tw/collection.schema.json), vendored in ../schema
 * (byte-identical to the contract commit of PAGE_SPEC_SCHEMA_SOURCE). The chat no longer opens collections (ADR 0059:
 * the Stock catalog is gone); only the session schema still $refs it for files written before.
 */
import collectionSchema from "../schema/collection.schema.json" with { type: "json" };
import type { SchemaRegistry } from "./json-schema.ts";

/** The registry with the collection schema, for schemas that $ref its items (session 1.3.0 `collection`). */
export function addCollectionSchema(target: SchemaRegistry): void {
	target.add(collectionSchema as Record<string, unknown>);
}

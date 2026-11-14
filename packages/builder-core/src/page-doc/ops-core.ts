/**
 * The shared parts of the page operations (`ops.ts`, `ops-rows.ts`): the operation type and result, the one failure and
 * success shapes, and the pure edits of a block's props by JSON pointer. No page logic here.
 */
import { cloneJson, type BlockV2, type PageV2, type PropValueV2 } from "@buildytech/page-contract";
import { pointerInfo } from "../catalog/props-schema.ts";
import { effectiveProps } from "./render.ts";
import { writePage, type WriteResult } from "./write.ts";
import type { DocIssue } from "./gate.ts";
import type { DiffEntry } from "./diff.ts";

export type PageOp =
	| { op: "set"; blockId: string; pointer: string; value: PropValueV2 | undefined }
	| { op: "set_variant"; blockId: string; variant: string }
	| { op: "reset"; blockId: string }
	| { op: "move"; blockId: string; to: number }
	| { op: "duplicate"; blockId: string }
	| { op: "remove"; blockId: string }
	| { op: "add"; item: string; variant?: string | null; at?: number }
	| { op: "replace"; blockId: string; item: string; variant?: string | null }
	| { op: "list_row"; blockId: string; pointer: string; action: "add" | "remove" | "up" | "down" | "duplicate"; row?: number }
	| { op: "map_entry"; blockId: string; pointer: string; action: "add" | "remove" | "rename"; key?: string; to?: string }
	| { op: "page"; field: "title" | "slug" | "locale" | "seo.title" | "seo.description"; value: string };

/** The most entries a list holds in the Inspector (records and plain values alike), unless its schema says fewer. */
export const MAX_ROWS = 24;

/** What a session history entry says an edit did (session 1.6.0 `op`). */
export type OpName = "set_field" | "set_variant" | "add" | "move" | "remove" | "insert" | "replace";

export type OpResult =
	| { ok: true; page: PageV2; blockId: string; op: OpName; path?: string; diff: DiffEntry[]; warnings: string[] }
	| { ok: false; code: string; message: string; pointer?: string; issues: DocIssue[] };

export const fail = (code: string, message: string, pointer = ""): OpResult => ({ ok: false, code, message, pointer, issues: [{ path: pointer || "/", code, expected: message }] });

export function done(result: WriteResult, blockId: string, op: OpName, path?: string): OpResult {
	if (!result.ok) return { ok: false, code: result.issues[0]?.code ?? "write_invalid", message: `${result.issues[0]?.path ?? "/"}: ${result.issues[0]?.expected ?? result.message}`, pointer: result.issues[0]?.path, issues: result.issues };
	return { ok: true, page: result.page, blockId, op, ...(path ? { path } : {}), diff: result.diff, warnings: result.warnings };
}


function pointerParts(pointer: string): string[] {
	return pointer.split("/").slice(1).map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/** A copy of `props` with `value` written at `pointer` (undefined removes it); null when the path does not exist above the last key. */
export function setAtPointer(props: Record<string, unknown>, pointer: string, value: unknown): Record<string, unknown> | null {
	const parts = pointerParts(pointer);
	if (!parts.length) return null;
	const root = cloneJson(props);
	let at: unknown = root;
	for (const part of parts.slice(0, -1)) {
		if (at === null || typeof at !== "object") return null;
		at = (at as Record<string, unknown>)[part];
	}
	if (at === null || typeof at !== "object") return null;
	const last = parts[parts.length - 1]!;
	if (Array.isArray(at)) {
		const index = Number(last);
		if (!Number.isInteger(index) || index < 0 || index > at.length) return null;
		if (value === undefined) at.splice(index, 1);
		else at[index] = value;
	} else if (value === undefined) delete (at as Record<string, unknown>)[last];
	else (at as Record<string, unknown>)[last] = value;
	return root;
}

export function valueAt(data: unknown, pointer: string): unknown {
	let current = data;
	for (const part of pointerParts(pointer)) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

/**
 * A copy of `props` where every optional object above `pointer` exists (`{}`; the write fills what the schema requires of it),
 * so an edit under an absent optional object creates just the path it needs. Null when a missing parent is not an object
 * of the schema (a missing list has no row to step into).
 */
export function ensureParents(item: string, props: Record<string, unknown>, pointer: string): Record<string, unknown> | null {
	const parts = pointerParts(pointer);
	let next = props;
	for (let depth = 1; depth < parts.length; depth += 1) {
		const prefix = `/${parts.slice(0, depth).map((part) => part.replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}`;
		const here = valueAt(next, prefix);
		if (here !== undefined && here !== null) continue;
		if (pointerInfo(item, prefix)?.kind !== "object") return null;
		const made = setAtPointer(next, prefix, {});
		if (!made) return null;
		next = made;
	}
	return next;
}

/** `props` without the optional objects `pointer` leaves empty once its own value is gone (a cleared edit never leaves `{}` behind). */
export function pruneEmpty(item: string, props: Record<string, unknown>, pointer: string): Record<string, unknown> {
	let next = props;
	const parts = pointerParts(pointer);
	for (let depth = parts.length - 1; depth >= 1; depth -= 1) {
		const prefix = `/${parts.slice(0, depth).join("/")}`;
		const here = valueAt(next, prefix);
		const info = pointerInfo(item, prefix);
		if (!info || info.required || (info.kind !== "object" && info.kind !== "map") || !here || typeof here !== "object" || Array.isArray(here) || Object.keys(here).length) break;
		next = setAtPointer(next, prefix, undefined) ?? next;
	}
	return next;
}

/** The effective props of a block (what the component renders) as the base of an edit. */
export function liveProps(block: BlockV2): Record<string, unknown> {
	return effectiveProps(block.item, block.variant, block.props);
}

export function replaceProps(page: PageV2, index: number, props: Record<string, unknown>, op: OpName, path?: string): OpResult {
	const block = page.blocks[index]!;
	return done(writePage(page, { patch: [{ op: "replace", path: `/blocks/${index}/props`, value: props }] }), block.id, op, path);
}

/**
 * RFC 6902 JSON Patch on a page-spec/v2 document (ADR 0034): add, remove, replace, move, copy, test. Pure, on a copy of
 * the document; one failing operation rejects the whole patch (RFC 6902) and says which one: the index, the path, what
 * the operation needed and what the document has.
 */
import type { DocIssue } from "./gate.ts";
import { cloneJson } from "./render.ts";

type Json = unknown;
const isObject = (value: Json): value is Record<string, Json> => typeof value === "object" && value !== null && !Array.isArray(value);

export type PatchOpLike = { op: string; path: string; from?: string; value?: unknown };

function parts(pointer: string): string[] {
	return pointer.split("/").slice(1).map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function same(a: Json, b: Json): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

type Failure = { code: string; expected: string; got?: unknown };

/** The container and key a pointer names (the parent must exist). */
function locate(doc: Json, pointer: string): { parent: Json; key: string } | Failure {
	const keys = parts(pointer);
	if (!keys.length) return { code: "path_invalid", expected: "a pointer below the document root" };
	let current = doc;
	for (const key of keys.slice(0, -1)) {
		if (Array.isArray(current)) {
			if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= current.length) return { code: "path_not_found", expected: `an existing array index (${current.length ? `0..${current.length - 1}` : "the list is empty: add a whole row at its path with /-"})`, got: key };
			current = current[Number(key)];
		} else if (isObject(current) && Object.hasOwn(current, key)) current = current[key];
		else return { code: "path_not_found", expected: `an existing key (${isObject(current) ? Object.keys(current).slice(0, 12).join(", ") : "an object"})`, got: key };
	}
	return { parent: current, key: keys.at(-1)! };
}

function isFailure(value: { parent: Json; key: string } | Failure): value is Failure {
	return "code" in value;
}

function read(parent: Json, key: string): { found: boolean; value?: Json } {
	if (Array.isArray(parent)) {
		if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= parent.length) return { found: false };
		return { found: true, value: parent[Number(key)] };
	}
	if (isObject(parent) && Object.hasOwn(parent, key)) return { found: true, value: parent[key] };
	return { found: false };
}

function insert(parent: Json, key: string, value: Json, replace: boolean): Failure | null {
	if (Array.isArray(parent)) {
		if (key === "-") {
			if (replace) return { code: "path_not_found", expected: "an existing array index (replace takes no '-')", got: key };
			parent.push(value);
			return null;
		}
		if (!/^(0|[1-9]\d*)$/.test(key)) return { code: "path_invalid", expected: "an array index or '-'", got: key };
		const at = Number(key);
		if (replace) {
			if (at >= parent.length) return { code: "path_not_found", expected: `an existing array index (0..${parent.length - 1})`, got: key };
			parent[at] = value;
			return null;
		}
		if (at > parent.length) return { code: "index_out_of_range", expected: `an index 0..${parent.length} (or '-')`, got: key };
		parent.splice(at, 0, value);
		return null;
	}
	if (isObject(parent)) {
		if (replace && !Object.hasOwn(parent, key)) return { code: "path_not_found", expected: `an existing key (${Object.keys(parent).slice(0, 12).join(", ")}); use add to create one`, got: key };
		parent[key] = value;
		return null;
	}
	return { code: "path_invalid", expected: "an object or array parent", got: typeof parent };
}

function remove(parent: Json, key: string): { removed: Json } | Failure {
	const hit = read(parent, key);
	if (!hit.found) return { code: "path_not_found", expected: Array.isArray(parent) ? `an existing array index (0..${parent.length - 1})` : `an existing key (${isObject(parent) ? Object.keys(parent).slice(0, 12).join(", ") : "an object"})`, got: key };
	if (Array.isArray(parent)) parent.splice(Number(key), 1);
	else delete (parent as Record<string, Json>)[key];
	return { removed: hit.value };
}

/** Applies the patch to a copy of `doc`; `issues` name the first failing operation (index and path in `path`). */
export function applyJsonPatch<T>(doc: T, ops: readonly PatchOpLike[]): { ok: true; doc: T } | { ok: false; issues: DocIssue[] } {
	const work = cloneJson(doc) as Json;
	let root: Json = work;
	for (const [index, op] of ops.entries()) {
		const at = (failure: Failure, path = op.path): { ok: false; issues: DocIssue[] } => ({
			ok: false,
			issues: [{ path, code: failure.code, expected: `ops[${index}] (${op.op} ${op.path}): ${failure.expected}`, got: failure.got }]
		});
		const target = locate(root, op.path);
		if (isFailure(target)) return at(target);
		if (op.op === "add" || op.op === "replace") {
			const failure = insert(target.parent, target.key, cloneJson(op.value), op.op === "replace");
			if (failure) return at(failure);
		} else if (op.op === "remove") {
			const out = remove(target.parent, target.key);
			if ("code" in out) return at(out);
		} else if (op.op === "test") {
			const hit = read(target.parent, target.key);
			if (!hit.found || !same(hit.value, op.value)) return at({ code: "test_failed", expected: `the value at ${op.path} to equal ${JSON.stringify(op.value)}`, got: hit.found ? hit.value : undefined });
		} else if (op.op === "move" || op.op === "copy") {
			const from = typeof op.from === "string" ? locate(root, op.from) : ({ code: "from_missing", expected: "a from pointer" } as Failure);
			if (isFailure(from)) return at(from, op.from ?? op.path);
			const hit = read(from.parent, from.key);
			if (!hit.found) return at({ code: "path_not_found", expected: `an existing value at from ${op.from}`, got: undefined }, op.from);
			const value = cloneJson(hit.value);
			if (op.op === "move") {
				if (op.path.startsWith(`${op.from}/`)) return at({ code: "path_invalid", expected: "a path outside the value being moved", got: op.path });
				const out = remove(from.parent, from.key);
				if ("code" in out) return at(out, op.from);
				// A move within one array lands at the index after the removal (RFC 6902 evaluates path on the shortened document).
				const after = locate(root, op.path);
				if (isFailure(after)) return at(after);
				const failure = insert(after.parent, after.key, value, false);
				if (failure) return at(failure);
			} else {
				const failure = insert(target.parent, target.key, value, false);
				if (failure) return at(failure);
			}
		} else return at({ code: "unknown_op", expected: "add, remove, replace, move, copy or test", got: op.op });
		root = work;
	}
	return { ok: true, doc: root as T };
}

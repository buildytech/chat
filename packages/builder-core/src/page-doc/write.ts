/**
 * write_page (ADR 0034): the one write of a page. Input is a full page-spec/v2 document or an RFC 6902 JSON Patch against
 * the base page. The host fills what the author of the write left out, so a write can be short:
 *   - a block without `id` gets a fresh one (`block-<item>`, unique);
 *   - a new block (no block of that id in the base page) gets the registry sample props of its variant under its own props;
 *   - a block whose `item` changed without props of its own gets the sample props of the new item; text props the two
 *     items share (title, lead, ...) are carried over;
 *   - a block whose `variant` changed without touching the layout axes gets the axes of the new variant's preset;
 *   - icon names are mapped to the published Lucide name (a name that matches nothing is dropped);
 *   - host-managed fields (id, status, createdAt, updatedAt) always come from the base page.
 * Blocks nothing touched stay byte for byte as they are. Then the one gate (gate.ts) judges the result; on failure the
 * answer is a list of { path, code, expected, got }. No local repair of a rejected write, no operation taxonomy.
 */
import { pagePatchV2Issues, type BlockV2, type PageV2, type PropValueV2 } from "@buildytech/page-contract";
import { propsFieldTree, propShapeFor, type PropsFieldNode } from "../catalog/props-schema.ts";
import { variantAxisProps, variantPreset } from "../catalog/organism.ts";
import { resolveIconName } from "../icon-name.ts";
import { diffPages, type DiffEntry } from "./diff.ts";
import { checkPageDoc, pointerOfSchemaPath, valueAtPointer, type DocIssue } from "./gate.ts";
import { applyJsonPatch } from "./jsonpatch.ts";
import { itemInfo } from "./items.ts";
import { cloneJson, effectiveProps, sampleProps } from "./render.ts";

export type WriteInput = { page?: unknown; patch?: unknown };
export type WriteOk = { ok: true; page: PageV2; diff: DiffEntry[]; warnings: string[]; changed: boolean };
export type WriteFailure = { ok: false; code: "write_invalid"; message: string; issues: DocIssue[] };
export type WriteResult = WriteOk | WriteFailure;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function failure(issues: DocIssue[]): WriteFailure {
	const first = issues[0]!;
	return {
		ok: false,
		code: "write_invalid",
		message: `The page was not written: ${issues.length} problem${issues.length > 1 ? "s" : ""}, first at ${first.path} (${first.code}). Nothing changed; fix the listed paths and call write_page again.`,
		issues
	};
}

/** `block-<item>`, made unique against `taken` within the id length. */
export function freshBlockId(item: string, taken: Set<string>): string {
	const base = `block-${item}`.slice(0, 56).replace(/-+$/, "");
	let id = base;
	for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
	taken.add(id);
	return id;
}

/** Icon props (fields of kind icon, in lists and objects) mapped to the published Lucide names; unknown names dropped. */
function repairIcons(item: string, props: Record<string, unknown>, notes: string[], at: string): Record<string, unknown> {
	const tree = propsFieldTree(item);
	if (!tree) return props;
	const walk = (value: unknown, nodes: PropsFieldNode[] | undefined, path: string): unknown => {
		if (!nodes || !isObject(value)) return value;
		const out: Record<string, unknown> = {};
		for (const [key, inner] of Object.entries(value)) {
			const node = nodes.find((entry) => entry.name === key);
			const here = `${path}/${key}`;
			if (node?.kind === "icon" && typeof inner === "string") {
				const fixed = resolveIconName(inner);
				if (fixed === null) notes.push(`${here}: icon "${inner}" is not a Lucide icon; dropped.`);
				else {
					if (fixed !== inner) notes.push(`${here}: icon "${inner}" written as "${fixed}".`);
					out[key] = fixed;
				}
			} else if (node?.kind === "list" && Array.isArray(inner)) out[key] = inner.map((row, index) => walk(row, node.fields, `${here}/${index}`));
			else if (node?.kind === "object") out[key] = walk(inner, node.fields, here);
			else out[key] = inner;
		}
		return out;
	};
	return walk(props, tree, `${at}/props`) as Record<string, unknown>;
}

/** Text props both items have (the same name, a string in the old props): kept when an item is swapped for another. */
function carriedText(oldProps: Record<string, unknown> | undefined, item: string): Record<string, PropValueV2> {
	const shape = propShapeFor(item);
	const out: Record<string, PropValueV2> = {};
	if (!oldProps || !shape) return out;
	for (const name of shape.text) if (name !== "id" && typeof oldProps[name] === "string" && oldProps[name] !== "") out[name] = oldProps[name] as string;
	return out;
}

/** The axes of a variant: top-level props every variant preset of the item sets (layout axes). */
function applyVariantAxes(item: string, variant: string | undefined, props: Record<string, unknown>): Record<string, unknown> {
	const info = itemInfo(item);
	const name = variant && info?.variants.includes(variant) ? variant : info?.defaultVariant;
	if (!name) return props;
	const preset = variantPreset(item, name);
	const out = { ...props };
	for (const axis of variantAxisProps(item)) {
		if (axis in preset) out[axis] = cloneJson(preset[axis]);
		else delete out[axis];
	}
	return out;
}

/** Fill, carry and repair the blocks a write touched; blocks identical to the base keep their bytes. */
export function normalizeBlocks(base: PageV2, next: PageV2, notes: string[]): void {
	const before = new Map(base.blocks.map((block) => [block.id, block]));
	const taken = new Set<string>([...(next.id ? [next.id] : []), ...next.blocks.map((block) => block.id).filter((id): id is string => typeof id === "string")]);
	next.blocks = next.blocks.map((block, index) => {
		if (!isObject(block) || typeof (block as { item?: unknown }).item !== "string") return block;
		const out: BlockV2 = { ...block } as BlockV2;
		if (typeof out.id !== "string" || out.id === "") out.id = freshBlockId(out.item, taken);
		const prior = before.get(out.id);
		const at = `/blocks/${index}`;
		if (prior && same(prior, out)) return prior;
		const info = itemInfo(out.item);
		if (!info) return out;
		let props: Record<string, unknown>;
		if (!prior) {
			// A new block: the sample props of its variant under what the write gave it.
			props = effectiveProps(out.item, out.variant, { ...sampleProps(out.item, out.variant, out.id), ...(out.props ?? {}) });
		} else if (prior.item !== out.item) {
			const wrote = out.props !== undefined && !same(out.props, prior.props);
			props = wrote
				? effectiveProps(out.item, out.variant, out.props)
				: effectiveProps(out.item, out.variant, { ...sampleProps(out.item, out.variant, out.id), ...carriedText(prior.props, out.item) });
			if (!wrote) notes.push(`${out.id}: item ${prior.item} -> ${out.item}; sample props of the new item, text carried over: ${Object.keys(carriedText(prior.props, out.item)).join(", ") || "none"}.`);
		} else {
			const props0 = out.props ?? prior.props ?? {};
			if ((prior.variant ?? "") !== (out.variant ?? "") && same(prior.props, out.props ?? prior.props)) {
				props = effectiveProps(out.item, out.variant, applyVariantAxes(out.item, out.variant, props0) as Record<string, PropValueV2>);
				notes.push(`${out.id}: variant ${prior.variant ?? "default"} -> ${out.variant ?? "default"}; layout axes taken from the new variant.`);
			} else props = effectiveProps(out.item, out.variant, props0);
		}
		out.props = repairIcons(out.item, props, notes, at) as Record<string, PropValueV2>;
		return out;
	});
}

const HOST_FIELDS = ["id", "status", "createdAt", "updatedAt"] as const;

/** One write: a full document or an RFC 6902 patch against `base`; the result is gated, normalized and diffed. */
export function writePage(base: PageV2, input: WriteInput, options: { now?: string } = {}): WriteResult {
	const notes: string[] = [];
	let next: unknown;
	if (input.patch !== undefined && input.page !== undefined) {
		return failure([{ path: "/", code: "write_ambiguous", expected: "either page (a full document) or patch (RFC 6902 operations), not both", got: "both" }]);
	}
	if (input.patch !== undefined) {
		const ops = Array.isArray(input.patch) ? input.patch : isObject(input.patch) && Array.isArray(input.patch.ops) ? input.patch.ops : input.patch;
		const issues = pagePatchV2Issues(ops);
		if (issues.length) {
			return failure(
				issues.slice(0, 12).map((issue) => ({
					path: pointerOfSchemaPath(issue.path),
					code: "patch_invalid",
					expected: issue.expected ?? `an RFC 6902 operation of page-patch/v2 (${issue.keyword})`,
					got: valueAtPointer(ops, pointerOfSchemaPath(issue.path).replace(/^\/(\d+)/, "/$1"))
				}))
			);
		}
		const applied = applyJsonPatch(base, ops as Array<{ op: string; path: string }>);
		if (!applied.ok) return failure(applied.issues);
		next = applied.doc;
	} else if (input.page !== undefined) {
		if (!isObject(input.page)) return failure([{ path: "/", code: "schema_invalid", expected: "a page-spec/v2 document (an object)", got: typeof input.page }]);
		next = cloneJson(input.page);
	} else {
		return failure([{ path: "/", code: "write_empty", expected: "page (a full document) or patch (RFC 6902 operations)", got: undefined }]);
	}
	const doc = next as PageV2;
	if (isObject(doc) && doc.version === undefined) doc.version = 2;
	for (const key of HOST_FIELDS) {
		if (base[key] !== undefined) (doc as Record<string, unknown>)[key] = base[key];
		else delete (doc as Record<string, unknown>)[key];
	}
	if (Array.isArray(doc.blocks)) normalizeBlocks(base, doc, notes);
	const gate = checkPageDoc(doc);
	if (!gate.ok) return failure(gate.issues);
	const diff = diffPages(base, gate.page);
	if (diff.length > 0 && base.updatedAt !== undefined) gate.page.updatedAt = options.now ?? new Date().toISOString();
	return { ok: true, page: gate.page, diff, warnings: notes, changed: diff.length > 0 };
}

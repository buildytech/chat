/**
 * Build inspector model (ADR 0014): the fields of one page block, straight from the pinned props schema of its
 * registry item (registry/props.v0.json), with the values the preview renders (`organismFor(block).props`) and, per
 * field, the page-spec field an edit is written back to. No hand-written field lists or hints: names, kinds, enums
 * and requiredness come from the schema; a field without a page-spec origin is shown read-only (the variant or the
 * schema default sets it). Pure data, no Svelte.
 */
import { parsePageSpec, type Page, type PageBlock, type PageBlockCopy, type PageCopyKey } from "@buildytech/page-contract";
import { organismFor, writableOrigin, type OrganismRender } from "./catalog/organism.ts";
import { checkBlockProps } from "./catalog/provenance.ts";
import { propsEventsFor, propsFieldTree, type PropsFieldNode } from "./catalog/props-schema.ts";
import { catalogVariantsFor } from "./catalog/sources.ts";

export type InspectorWidget = "text" | "longtext" | "icon" | "enum" | "boolean" | "number" | "object" | "list" | "other";

export type InspectorField = {
	/** JSON Pointer of the prop in the block's render props (`/title`, `/features/2/icon`). */
	pointer: string;
	name: string;
	widget: InspectorWidget;
	required: boolean;
	value: unknown;
	/** Page-spec field an edit writes (`copy.headline`, `children[2].copy.icon`); null: read-only. */
	origin: string | null;
	/** enum: the schema's values. */
	options?: string[];
	maxLength?: number;
	/** object: its fields. */
	fields?: InspectorField[];
	/** list of records: one entry per row, with the row's page-spec origin (`children[2]`) when it is a page row. */
	rows?: Array<{ pointer: string; origin: string | null; fields: InspectorField[] }>;
};

export type InspectorModel =
	| {
			ok: true;
			blockId: string;
			kind: string;
			title: string;
			catalogBlock: string;
			item: string;
			variant: string;
			/** Variants the catalog block offers (set_variant). */
			variants: string[];
			fields: InspectorField[];
	  }
	| { ok: false; blockId: string; kind: string; title: string; reason: "not_in_registry" | "no_schema" };

/** Never edited in the inspector: identity and host wiring. */
const HIDDEN = new Set(["id", "class", "className"]);
/** Page-spec origins of long text (a summary / lede) get a multi-line widget. */
const LONG_ORIGIN = /(?:^|\.)(?:summary|copy\.lede)$/;
const LONG_TEXT = 200;

function valueAt(data: unknown, pointer: string): unknown {
	let current = data;
	for (const part of pointer.split("/").slice(1)) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

function widgetFor(node: PropsFieldNode, origin: string | null): InspectorWidget {
	switch (node.kind) {
		case "text":
			return (origin && LONG_ORIGIN.test(origin)) || (node.maxLength ?? 0) > LONG_TEXT ? "longtext" : "text";
		case "icon":
		case "enum":
		case "boolean":
		case "number":
		case "object":
			return node.kind;
		case "list":
			return node.fields ? "list" : "other";
		default:
			return "other";
	}
}

function fieldsOf(block: PageBlock, render: OrganismRender, nodes: PropsFieldNode[], base: string, hidden: ReadonlySet<string>): InspectorField[] {
	const out: InspectorField[] = [];
	for (const node of nodes) {
		if (HIDDEN.has(node.name) || hidden.has(node.name)) continue;
		const pointer = `${base}/${node.name}`;
		const origin = writableOrigin(block, render, pointer);
		const field: InspectorField = {
			pointer,
			name: node.name,
			widget: widgetFor(node, origin),
			required: node.required,
			value: valueAt(render.props, pointer),
			origin
		};
		if (node.enum) field.options = node.enum;
		if (node.maxLength !== undefined) field.maxLength = node.maxLength;
		if (field.widget === "object" && node.fields) field.fields = fieldsOf(block, render, node.fields, pointer, new Set());
		if (field.widget === "list" && node.fields) {
			const rows = Array.isArray(field.value) ? field.value : [];
			field.rows = rows.map((_, index) => {
				const at = `${pointer}/${index}`;
				const row = render.origins[at];
				return { pointer: at, origin: row && /^children\[\d+\]$/.test(row) ? row : null, fields: fieldsOf(block, render, node.fields!, at, new Set()) };
			});
		}
		out.push(field);
	}
	return out;
}

/** The inspector fields of a page block, or an honest stub when it has no registry item or no published schema. */
export function inspectorModel(block: PageBlock): InspectorModel {
	const head = { blockId: block.id, kind: block.kind, title: block.title };
	const render = organismFor(block);
	if (!render) return { ok: false, ...head, reason: "not_in_registry" };
	const tree = propsFieldTree(render.item);
	if (!tree) return { ok: false, ...head, reason: "no_schema" };
	const { events, slots } = propsEventsFor(render.item);
	return {
		ok: true,
		...head,
		catalogBlock: render.catalogBlock,
		item: render.item,
		variant: render.variant,
		variants: catalogVariantsFor(render.catalogBlock),
		fields: fieldsOf(block, render, tree, "", new Set([...events, ...slots]))
	};
}

// ---- Write-back (step 3) ----------------------------------------------------------------------------------------

export type InspectorFailure = {
	ok: false;
	code: string;
	message: string;
	/** The field the rejection belongs to (JSON Pointer of the render props). */
	pointer: string;
	/** enum / icon rejections: every allowed value of the schema. */
	allowed?: string[];
};
export type InspectorSuccess = { ok: true; page: Page; /** The block to keep selected. */ blockId: string };
export type InspectorResult = InspectorSuccess | InspectorFailure;

const fail = (code: string, message: string, pointer: string, allowed?: string[]): InspectorFailure =>
	allowed?.length ? { ok: false, code, message, pointer, allowed } : { ok: false, code, message, pointer };

const ORIGIN = /^((?:children\[\d+\]\.)*)(title|summary|copy\.([a-z]+))$/;

/** The block with `origin` (`copy.headline`, `children[2].copy.icon`, `title`) set to `value`; other fields kept. */
export function writeOrigin(block: PageBlock, origin: string, value: string): PageBlock | null {
	const match = ORIGIN.exec(origin);
	if (!match) return null;
	const path = [...match[1]!.matchAll(/children\[(\d+)\]\./g)].map((hit) => Number(hit[1]));
	const field = match[2]!;
	const set = (node: PageBlock, depth: number): PageBlock | null => {
		if (depth < path.length) {
			const index = path[depth]!;
			const child = node.children?.[index];
			if (!child) return null;
			const next = set(child, depth + 1);
			if (!next) return null;
			const children = [...node.children!];
			children[index] = next;
			return { ...node, children };
		}
		if (field === "title" || field === "summary") return { ...node, [field]: value };
		const copy: PageBlockCopy = { ...node.copy, [match[3]! as PageCopyKey]: value };
		return { ...node, copy };
	};
	return set(block, 0);
}

/** `next` with every top-level block that did not change replaced by the object of `prev` (only changed blocks re-render). */
export function shareUnchanged(prev: Page, next: Page): Page {
	const before = new Map(prev.layout.blocks.map((node) => [node.id, node]));
	const blocks = next.layout.blocks.map((node) => {
		const old = before.get(node.id);
		return old && JSON.stringify(old) === JSON.stringify(node) ? old : node;
	});
	return { ...next, layout: { ...next.layout, blocks } };
}

type Issue = { pointer: string; message: string; allowed?: unknown[]; value?: unknown };

/**
 * The inspector gate: the page-spec schema + parsePage program checks on the whole page, then the props gate (Ajv
 * 2020 over the published schema, fail closed) on every changed top-level block. Nothing is written on failure.
 */
export function gateInspectorPage(base: Page, blocks: PageBlock[], changed: readonly string[], pointer: string, now?: string): InspectorFailure | { ok: true; page: Page } {
	let page: Page;
	try {
		page = parsePageSpec({ ...base, layout: { ...base.layout, blocks }, updatedAt: now ?? new Date().toISOString() }, { draft: base.status === "draft" });
	} catch (err) {
		const rec = err as { code?: string; path?: string; message?: string };
		return fail(rec.code ?? "page_spec_invalid", rec.message ?? "The page does not match page-spec/v1.", pointer);
	}
	for (const id of changed) {
		const index = page.layout.blocks.findIndex((node) => node.id === id);
		if (index < 0) continue;
		const error = checkBlockProps(page.layout.blocks[index]!, `layout.blocks[${index}]`);
		if (!error) continue;
		const issues = ((error as { issues?: Issue[] }).issues ?? []) as Issue[];
		const issue = issues.find((row) => row.pointer === pointer) ?? issues[0];
		if (!issue) return fail(error.code, error.message, pointer);
		const value = issue.value !== undefined ? ` ${JSON.stringify(issue.value)}` : "";
		return fail(error.code, `${issue.pointer || "(props)"}${value}: ${issue.message}.`, issue.pointer || pointer, issue.allowed?.map(String));
	}
	return { ok: true, page: shareUnchanged(base, page) };
}

/**
 * Write one inspector field back to the page: the field's page-spec origin (override only; variant presets and
 * schema defaults are never copied into the page), then the inspector gate. On failure the page is unchanged and
 * the result names the field, the reason and, for an enum, the allowed values.
 */
export function inspectorSetField(page: Page, blockId: string, pointer: string, value: string, now?: string): InspectorResult {
	const index = page.layout.blocks.findIndex((node) => node.id === blockId);
	const block = page.layout.blocks[index];
	if (!block) return fail("block_not_found", `No section ${blockId} on this page.`, pointer);
	const render = organismFor(block);
	if (!render) return fail("not_in_registry", `Section ${blockId} has no registry block.`, pointer);
	const origin = writableOrigin(block, render, pointer);
	if (!origin) return fail("field_not_editable", `${pointer} is set by the variant ${render.variant}, not by the page.`, pointer);
	const next = writeOrigin(block, origin, value);
	if (!next) return fail("field_not_editable", `${pointer} has no page field ${origin}.`, pointer);
	const blocks = [...page.layout.blocks];
	blocks[index] = next;
	const gated = gateInspectorPage(page, blocks, [blockId], pointer, now);
	return gated.ok ? { ok: true, page: gated.page, blockId } : gated;
}

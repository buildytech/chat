/**
 * Build inspector model (ADR 0014): the fields of one page block, straight from the pinned props schema of its
 * registry item (registry/props.v0.json), with the values the preview renders (`organismFor(block).props`) and, per
 * field, the page-spec field an edit is written back to. No hand-written field lists or hints: names, kinds, enums
 * and requiredness come from the schema; a field without a page-spec origin is shown read-only (the variant or the
 * schema default sets it). Pure data, no Svelte.
 */
import type { PageBlock } from "@buildytech/page-contract";
import { organismFor, writableOrigin, type OrganismRender } from "./catalog/organism.ts";
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

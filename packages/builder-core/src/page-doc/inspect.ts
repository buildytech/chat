/**
 * Build inspector model of a page-spec/v2 block (ADR 0034): the fields of the registry item's props schema with the
 * values the component renders. Every field is editable and an edit is a write into `block.props` at the field's JSON
 * Pointer (applyOp `set`); there is no copy slot, origin, lock or override layer. Names, kinds, enums and requiredness
 * come from the published props schema. Pure data, no Svelte.
 */
import type { BlockV2 } from "@buildytech/page-contract";
import { propsEventsFor, propsFieldTree, type ListItemNode, type PropsFieldNode } from "../catalog/props-schema.ts";
import { itemInfo } from "./items.ts";
import { effectiveProps } from "./render.ts";

export type InspectorWidget = "text" | "longtext" | "icon" | "enum" | "boolean" | "number" | "object" | "list" | "values" | "other";

export type InspectorField = {
	/** JSON Pointer of the prop in the block's props (`/title`, `/features/2/icon`). */
	pointer: string;
	name: string;
	widget: InspectorWidget;
	required: boolean;
	value: unknown;
	/** enum: the schema's values, as text (what the select shows and carries). */
	options?: string[];
	/** enum: the schema's values in their own type, only when one is not a string (`level` is 1 | 2): what an edit writes. */
	optionValues?: Array<string | number | boolean | null>;
	maxLength?: number;
	/** list of records or of plain values: how many entries it may hold. */
	list?: { max: number; min: number };
	/** list of plain values (`values`): one field per entry, at `<list pointer>/<index>`. */
	items?: InspectorField[];
	/** object: its fields. */
	fields?: InspectorField[];
	/** list of records: one entry per row. */
	rows?: Array<{ pointer: string; fields: InspectorField[] }>;
};

export type InspectorModel =
	| { ok: true; blockId: string; title: string; item: string; variant: string; variants: string[]; fields: InspectorField[] }
	| { ok: false; blockId: string; title: string; reason: "not_in_registry" | "no_schema" };

/** Never edited in the inspector: identity and host wiring. */
const HIDDEN = new Set(["id", "class", "className"]);
const LONG_TEXT = 200;
const LONG_NAMES = /^(?:lede|summary|description|text|body|answer|quote)$/;
const MAX_ROWS = 24;

function valueAt(data: unknown, pointer: string): unknown {
	let current = data;
	for (const part of pointer.split("/").slice(1)) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

function widgetFor(node: PropsFieldNode): InspectorWidget {
	switch (node.kind) {
		case "text":
			return LONG_NAMES.test(node.name) || (node.maxLength ?? 0) > LONG_TEXT ? "longtext" : "text";
		case "icon":
		case "enum":
		case "boolean":
		case "number":
		case "object":
			return node.kind;
		case "list":
			return node.fields ? "list" : node.item ? "values" : "other";
		default:
			return "other";
	}
}

function fieldsOf(props: Record<string, unknown>, nodes: PropsFieldNode[], base: string, hidden: ReadonlySet<string>): InspectorField[] {
	const out: InspectorField[] = [];
	for (const node of nodes) {
		if (HIDDEN.has(node.name) || hidden.has(node.name)) continue;
		const pointer = `${base}/${node.name}`;
		const field: InspectorField = { pointer, name: node.name, widget: widgetFor(node), required: node.required, value: valueAt(props, pointer) };
		if (node.enum) field.options = node.enum;
		if (node.enumValues?.some((value) => typeof value !== "string")) field.optionValues = node.enumValues;
		if (node.maxLength !== undefined) field.maxLength = node.maxLength;
		if (field.widget === "object" && node.fields) field.fields = fieldsOf(props, node.fields, pointer, new Set());
		if (field.widget === "list" && node.fields) {
			const rows = Array.isArray(field.value) ? field.value : [];
			field.list = { max: Math.min(node.maxItems ?? MAX_ROWS, MAX_ROWS), min: node.minItems ?? 0 };
			field.rows = rows.map((_, index) => ({ pointer: `${pointer}/${index}`, fields: fieldsOf(props, node.fields!, `${pointer}/${index}`, new Set()) }));
		}
		if (field.widget === "values" && node.item) {
			const entries = Array.isArray(field.value) ? field.value : [];
			field.list = { max: Math.min(node.maxItems ?? MAX_ROWS, MAX_ROWS), min: node.minItems ?? 0 };
			field.items = entries.map((entry, index) => entryField(node.item!, `${pointer}/${index}`, `${node.name} ${index + 1}`, entry));
		}
		out.push(field);
	}
	return out;
}

/** One entry of a list of plain values as a field of its own (so it edits like any scalar prop). */
function entryField(item: ListItemNode, pointer: string, name: string, value: unknown): InspectorField {
	const field: InspectorField = { pointer, name, widget: item.kind, required: true, value };
	if (item.enum) field.options = item.enum;
	if (item.enumValues?.some((entry) => typeof entry !== "string")) field.optionValues = item.enumValues;
	if (item.maxLength !== undefined) field.maxLength = item.maxLength;
	return field;
}

/** The inspector fields of a block, or an honest stub when its item is not in the registry or has no published schema. */
export function inspectorModel(block: Pick<BlockV2, "id" | "item" | "variant" | "props">): InspectorModel {
	const info = itemInfo(block.item);
	const head = { blockId: block.id, title: info?.title ?? block.item };
	if (!info) return { ok: false, ...head, reason: "not_in_registry" };
	const tree = propsFieldTree(block.item);
	if (!tree) return { ok: false, ...head, reason: "no_schema" };
	const { events, slots } = propsEventsFor(block.item);
	const variant = block.variant && info.variants.includes(block.variant) ? block.variant : info.defaultVariant;
	const props = effectiveProps(block.item, variant, block.props);
	return { ok: true, ...head, item: block.item, variant, variants: info.variants, fields: fieldsOf(props, tree, "", new Set([...events, ...slots])) };
}

/**
 * The JSON value a field widget typed as text, as `block.props` holds it (undefined: the prop is removed). The one place
 * the Inspector turns widget text into a typed value: a boolean from a checkbox, a number, an enum member in the type
 * the schema declares (1 | 2 stays a number, not "2").
 */
export function inspectorValue(field: Pick<InspectorField, "widget" | "required" | "optionValues">, text: string): string | number | boolean | null | undefined {
	switch (field.widget) {
		case "boolean":
			return text === "true";
		case "number": {
			if (text.trim() === "") return field.required ? 0 : undefined;
			const n = Number(text);
			return Number.isFinite(n) ? n : (text as unknown as number);
		}
		case "enum": {
			if (text === "") return undefined;
			const typed = field.optionValues?.find((value) => String(value) === text);
			return typed === undefined ? text : typed;
		}
		default:
			return text === "" && !field.required ? undefined : text;
	}
}

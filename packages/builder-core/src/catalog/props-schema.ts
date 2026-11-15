/**
 * Published props schemas of the registry blocks (registry.buildy.tw/props/v0.json, JSON Schema 2020-12), pinned by
 * scripts/registry-snapshot.mjs into props.json with every shared $def stored once. This module reads the schemas
 * without a validator (browser-safe): the prop shape of a block (text props, list props and their record fields,
 * object props), the defaults of required props, the Lucide names of the contract, events and slots, and a compact
 * summary for the model. Validation itself is props-gate.ts (Ajv 2020, strict), loaded lazily in the browser.
 *
 * Nothing here is hand-written block data: every name, type, enum and default comes from the published schema.
 */
import { isImageName } from "./image-url.ts";
import { isMoneyName } from "./money.ts";
import raw from "./props.json" with { type: "json" };

export type JsonSchema = Record<string, unknown>;

/**
 * The generated view map of a block (codegen-x, alexy-os/chaosbun#149): where each prop lands in the rendered DOM, so
 * the chat can tie a preview element to the prop it renders and back. `rows` maps a list pointer to the `data-slot`
 * names its rows carry; `fields` maps a prop pointer (a list index written `[]`) to the places it shows: the slot it
 * sits inside (`in`), its own element's slot (`s`), and how it shows (`k`: text, html, an attribute `a`, or a Lucide
 * icon). Never hand-written; `view-map.ts` resolves a pointer to an element and an element to a pointer.
 */
export type ViewField = { in?: string; s?: string; k: "text" | "html" | "attr" | "icon"; a?: string; f?: 1 };
export type ViewMap = { rows: Record<string, string[]>; fields: Record<string, ViewField[]> };

type CompactProps = {
	format: "buildy-props-compact";
	version: number;
	registry: string;
	propsVersion: string;
	digest: string;
	defs: Record<string, JsonSchema>;
	items: Record<string, { organism: string; events: string[]; slots: string[]; schema: JsonSchema; defs: string[]; viewMap?: ViewMap }>;
};

export const props = raw as unknown as CompactProps;

/** The contract's shared $def of a Lucide icon name (an enum of the names the kit ships). */
const ICON_DEF = "lucideIcon";
/** Neutral placeholder of a required icon nobody filled; used only when the contract's enum contains it. */
export const PLACEHOLDER_ICON = "circle-dot";
/** Strings the kit parses (Intl currency code, locale, link) need a valid value, not a label. */
export const STRING_DEFAULTS: Record<string, string> = { currency: "USD", locale: "en", href: "#", id: "item" };

export const propsDigest: string = props.digest;
export function propsItems(): string[] {
	return Object.keys(props.items);
}

export function hasPropsSchema(item: string): boolean {
	return Boolean(props.items[item]);
}

/** The published JSON Schema of an item's props, rebuilt with exactly its $defs (byte-equal to the pinned file). */
export function propsSchemaFor(item: string): JsonSchema | null {
	const entry = props.items[item];
	if (!entry) return null;
	return { ...entry.schema, $defs: Object.fromEntries(entry.defs.map((name) => [name, props.defs[name]])) };
}

/** Events (callbacks the host wires, never data) and slots (snippets) of a block, next to its schema. */
export function propsEventsFor(item: string): { events: string[]; slots: string[] } {
	const entry = props.items[item];
	return { events: entry?.events ?? [], slots: entry?.slots ?? [] };
}

/** The generated view map of a block, or null for an item (or an older registry pin) that carries none. */
export function viewMapFor(item: string): ViewMap | null {
	return props.items[item]?.viewMap ?? null;
}

/** Lucide icon names of the contract (the published `lucideIcon` enum: every glyph of the registry's pinned Lucide). */
export function lucideIcons(): string[] {
	const def = props.defs[ICON_DEF];
	return Array.isArray(def?.enum) ? (def.enum as string[]) : [];
}

/**
 * What the model is told about icons instead of the name list (about 1.9k names): any Lucide name in kebab-case. The
 * host checks it against lucideIcons(), maps spelling variants and drops what Lucide does not have (icon-name.ts).
 */
export const LUCIDE_ICON_HINT = "any Lucide icon name in kebab-case (lucide.dev/icons); the host checks it against the full Lucide set and drops unknown names";

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function refName(node: JsonSchema): string | null {
	const ref = node.$ref;
	return typeof ref === "string" && ref.startsWith("#/$defs/") ? ref.slice("#/$defs/".length) : null;
}

function deref(node: JsonSchema): JsonSchema {
	let current = node;
	for (let depth = 0; depth < 16; depth += 1) {
		const name = refName(current);
		if (!name) return current;
		current = props.defs[name] ?? {};
	}
	return current;
}

/**
 * A reference shape of the contract (a ui-dictionary ref `{"$": "ui.*"}`, a data ref `{"$": name}` or a data op
 * `{op, args}`): the block reads the value from elsewhere. The page content never writes one.
 */
function isRefShape(node: JsonSchema): boolean {
	const target = deref(node);
	if (Array.isArray(target.anyOf)) return (target.anyOf as JsonSchema[]).every(isRefShape);
	const required = Array.isArray(target.required) ? (target.required as string[]) : [];
	return target.type === "object" && (required.includes("$") || (required.includes("op") && required.includes("args")));
}

/** $defs that are reference shapes; errors inside them are noise of an anyOf branch the content never takes. */
export const refShapeDefs: ReadonlySet<string> = new Set(Object.keys(props.defs).filter((name) => isRefShape({ $ref: `#/$defs/${name}` })));

/** The value schema of a node: refs followed, reference-shape branches of an anyOf dropped. */
export function valueOf(node: JsonSchema): JsonSchema {
	const target = deref(node);
	if (Array.isArray(target.anyOf)) {
		const branches = (target.anyOf as JsonSchema[]).filter((branch) => !isRefShape(branch));
		if (branches.length === 1) return valueOf(branches[0]!);
	}
	return target;
}

/** `map`: an object with free keys whose values are plain (strings, numbers, booleans, enum members): `badges: { sku: "Sale" }`. */
export type FieldKind = "text" | "icon" | "enum" | "number" | "boolean" | "list" | "object" | "map" | "other";

export function kindOf(node: JsonSchema): FieldKind {
	if (refName(node) === ICON_DEF) return "icon";
	const value = valueOf(node);
	if (refName(value) === ICON_DEF) return "icon";
	if (Array.isArray(value.enum)) return "enum";
	if (value.type === "string") return "text";
	if (value.type === "number" || value.type === "integer") return "number";
	if (value.type === "boolean") return "boolean";
	if (value.type === "array") return "list";
	if (value.type === "object" && isObject(value.properties)) return "object";
	if (value.type === "object" && !isObject(value.properties) && isObject(value.additionalProperties) && ITEM_KINDS.has(kindOf(value.additionalProperties as JsonSchema))) return "map";
	return "other";
}

/** Fields of an object schema: name -> kind, and the required names. */
function fieldsOf(node: JsonSchema): { fields: Record<string, FieldKind>; required: string[] } {
	const value = valueOf(node);
	const properties = isObject(value.properties) ? (value.properties as Record<string, JsonSchema>) : {};
	return {
		fields: Object.fromEntries(Object.entries(properties).map(([name, inner]) => [name, kindOf(inner)])),
		required: Array.isArray(value.required) ? (value.required as string[]) : []
	};
}

export type PropShape = {
	/** Prop names in schema order. */
	props: string[];
	required: string[];
	/** Props whose value is plain text. */
	text: string[];
	/** Props whose value is a list of records: record field kinds and the required record fields. */
	lists: Record<string, { required: boolean; record: Record<string, FieldKind>; recordRequired: string[] }>;
	/** Props whose value is one object: its field kinds. */
	objects: Record<string, Record<string, FieldKind>>;
	/** Enum props (layout axes and the like) with their values. */
	enums: Record<string, string[]>;
};

const SHAPES = new Map<string, PropShape>();

/** The prop shape of a registry block, derived from its published schema. */
export function propShapeFor(item: string): PropShape | null {
	const cached = SHAPES.get(item);
	if (cached) return cached;
	const schema = props.items[item]?.schema;
	if (!schema) return null;
	const top = fieldsOf(schema);
	const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
	const shape: PropShape = { props: Object.keys(properties), required: top.required, text: [], lists: {}, objects: {}, enums: {} };
	for (const [name, inner] of Object.entries(properties)) {
		const kind = top.fields[name];
		if (kind === "text") shape.text.push(name);
		else if (kind === "enum") shape.enums[name] = (valueOf(inner).enum as unknown[]).map(String);
		else if (kind === "list") {
			const items = valueOf(inner).items as JsonSchema | undefined;
			if (items && kindOf(items) === "object") {
				const record = fieldsOf(items);
				shape.lists[name] = { required: top.required.includes(name), record: record.fields, recordRequired: record.required };
			}
		} else if (kind === "object") shape.objects[name] = fieldsOf(inner).fields;
	}
	SHAPES.set(item, shape);
	return shape;
}

/** One entry of a list of plain values. */
export type ListItemNode = {
	kind: "text" | "number" | "boolean" | "enum";
	enum?: string[];
	enumValues?: Array<string | number | boolean | null>;
	maxLength?: number;
};

const ITEM_KINDS = new Set<FieldKind>(["text", "number", "boolean", "enum"]);

/** What one list entry or map value is, when it is a plain value (undefined for records and anything else). */
function itemNodeOf(entry: JsonSchema): ListItemNode | undefined {
	const entryKind = kindOf(entry);
	if (!ITEM_KINDS.has(entryKind)) return undefined;
	const value = valueOf(entry);
	const item: ListItemNode = { kind: entryKind as ListItemNode["kind"] };
	if (entryKind === "enum") {
		item.enum = (value.enum as unknown[]).map(String);
		item.enumValues = value.enum as ListItemNode["enumValues"];
	}
	if (entryKind === "text" && typeof value.maxLength === "number") item.maxLength = value.maxLength;
	return item;
}

/** One prop of a block schema as a tree: its kind, whether it is required, enum values and nested fields. */
export type PropsFieldNode = {
	name: string;
	kind: FieldKind;
	required: boolean;
	/** number: money in minor units (a name the registry formats with fmtMoney, beside a `currency` prop; money.ts). */
	money?: true;
	/** text: a picture address (an https URL or a relative path; image-url.ts). */
	image?: true;
	/** enum: the allowed values (layout axes and the like); the icon enum is lucideIcons(). */
	enum?: string[];
	/** enum: the schema's values as written (numbers stay numbers: `level` 1 | 2). */
	enumValues?: Array<string | number | boolean | null>;
	/** list: the schema's maxItems, when it sets one. */
	maxItems?: number;
	/** list: the schema's minItems, when it sets one. */
	minItems?: number;
	/** list of plain values (strings, numbers, booleans, enum members) or map: what one entry (value) is; lists of records have `fields`. */
	item?: ListItemNode;
	/** map: the pattern the keys must match (`propertyNames.pattern`), when the schema sets one. */
	keyPattern?: string;
	/** text: the schema's maxLength, when it sets one. */
	maxLength?: number;
	/** object: its fields; list: the fields of one record (lists of plain values have none). */
	fields?: PropsFieldNode[];
};

function fieldTree(node: JsonSchema, depth: number): PropsFieldNode[] {
	const value = valueOf(node);
	const properties = isObject(value.properties) ? (value.properties as Record<string, JsonSchema>) : {};
	const required = Array.isArray(value.required) ? (value.required as string[]) : [];
	const hasCurrency = Object.entries(properties).some(([other, entry]) => other === "currency" && kindOf(entry) === "text");
	return Object.entries(properties).map(([name, inner]) => {
		const kind = kindOf(inner);
		const target = valueOf(inner);
		const out: PropsFieldNode = { name, kind, required: required.includes(name) };
		if (kind === "number" && hasCurrency && isMoneyName(name)) out.money = true;
		if (kind === "text" && isImageName(name)) out.image = true;
		if (kind === "enum") {
			out.enum = (target.enum as unknown[]).map(String);
			out.enumValues = target.enum as Array<string | number | boolean | null>;
		}
		if (kind === "list" && typeof target.maxItems === "number") out.maxItems = target.maxItems;
		if (kind === "list" && typeof target.minItems === "number") out.minItems = target.minItems;
		if (kind === "text" && typeof target.maxLength === "number") out.maxLength = target.maxLength;
		if (depth < 6 && kind === "object") out.fields = fieldTree(inner, depth + 1);
		if (depth < 6 && kind === "list" && isObject(target.items)) {
			const entry = target.items as JsonSchema;
			if (kindOf(entry) === "object") out.fields = fieldTree(entry, depth + 1);
			else out.item = itemNodeOf(entry);
		}
		if (kind === "map") {
			out.item = itemNodeOf(target.additionalProperties as JsonSchema);
			if (typeof target.minProperties === "number") out.minItems = target.minProperties;
			if (typeof target.maxProperties === "number") out.maxItems = target.maxProperties;
			const names = target.propertyNames as JsonSchema | undefined;
			if (isObject(names) && typeof names.pattern === "string") out.keyPattern = names.pattern;
		}
		return out;
	});
}

/** Every prop of a registry block's published schema as a field tree (schema order), or null without a schema. */
export function propsFieldTree(item: string): PropsFieldNode[] | null {
	const schema = props.items[item]?.schema;
	return schema ? fieldTree(schema, 0) : null;
}

/** The schema node of a prop pointer (`/content/features`), list indices stepping into the row schema. */
export function schemaAt(item: string, pointer: string): JsonSchema | null {
	const schema = props.items[item]?.schema;
	if (!schema) return null;
	let node: JsonSchema = schema;
	for (const part of pointer.split("/").slice(1)) {
		const value = valueOf(node);
		if (value.type === "array" && /^\d+$/.test(part) && isObject(value.items)) {
			node = value.items as JsonSchema;
			continue;
		}
		const properties = isObject(value.properties) ? (value.properties as Record<string, JsonSchema>) : null;
		if (!properties?.[part]) return null;
		node = properties[part]!;
	}
	return node;
}

type PointerInfo = {
	/** What the prop is: an object with fields, a list, a free-form map (`additionalProperties`), or a plain value. */
	kind: "object" | "array" | "map" | "scalar";
	/** The prop is required by its parent object (a list row is). */
	required: boolean;
	minItems?: number;
	maxItems?: number;
	/** map: the pattern its keys must match. */
	keyPattern?: string;
};

/** What the schema says about a prop pointer (`/filter/tabs`, `/features/2/icon`), or null when the path is not in the schema. */
export function pointerInfo(item: string, pointer: string): PointerInfo | null {
	const schema = props.items[item]?.schema;
	if (!schema) return null;
	let node: JsonSchema = schema;
	let required = true;
	for (const raw of pointer.split("/").slice(1)) {
		const part = raw.replace(/~1/g, "/").replace(/~0/g, "~");
		const value = valueOf(node);
		if (value.type === "array" && /^\d+$/.test(part) && isObject(value.items)) {
			node = value.items as JsonSchema;
			required = true;
			continue;
		}
		const properties = isObject(value.properties) ? (value.properties as Record<string, JsonSchema>) : null;
		if (properties?.[part]) {
			required = Array.isArray(value.required) && (value.required as string[]).includes(part);
			node = properties[part]!;
			continue;
		}
		if (value.type === "object" && !properties && value.additionalProperties) {
			required = false;
			node = value.additionalProperties === true ? {} : (value.additionalProperties as JsonSchema);
			continue;
		}
		return null;
	}
	const value = valueOf(node);
	const kind = value.type === "array" ? "array" : value.type === "object" ? (isObject(value.properties) ? "object" : "map") : "scalar";
	return {
		kind,
		required,
		...(typeof (value.minItems ?? value.minProperties) === "number" ? { minItems: (value.minItems ?? value.minProperties) as number } : {}),
		...(typeof (value.maxItems ?? value.maxProperties) === "number" ? { maxItems: (value.maxItems ?? value.maxProperties) as number } : {}),
		...(isObject(value.propertyNames) && typeof (value.propertyNames as JsonSchema).pattern === "string" ? { keyPattern: (value.propertyNames as JsonSchema).pattern as string } : {})
	};
}

function kindLabel(kind: FieldKind): string {
	return kind === "text" ? "" : `:${kind}`;
}

/**
 * Compact model view of a block's schema: the list prop the page rows become (`features[]: id title text icon href?`,
 * optional fields with `?`), the object props, and events / slots. Enums of layout axes are left to the variants
 * (each variant already names its axis values); icons are described once in catalogSources.icons (LUCIDE_ICON_HINT).
 */
export function propsSummaryFor(item: string): Record<string, string> | null {
	const shape = propShapeFor(item);
	if (!shape) return null;
	const out: Record<string, string> = {};
	const lists = Object.entries(shape.lists).sort(([, a], [, b]) => Number(b.required) - Number(a.required));
	if (lists.length) {
		const [name, list] = lists[0]!;
		out.rows = `${name}[]: ${Object.entries(list.record)
			.map(([field, kind]) => `${field}${kindLabel(kind)}${list.recordRequired.includes(field) ? "" : "?"}`)
			.join(" ")}`;
	}
	const text = shape.text.filter((name) => name !== "id" && name !== "landmarkLabel");
	if (text.length) out.text = text.join(" ");
	const { events, slots } = propsEventsFor(item);
	if (events.length) out.events = events.join(" ");
	if (slots.length) out.slots = slots.join(" ");
	return out;
}

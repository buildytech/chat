/**
 * Published props schemas of the registry blocks (registry.buildy.tw/props/v0.json, JSON Schema 2020-12), pinned by
 * scripts/registry-snapshot.mjs into props.json with every shared $def stored once. This module reads the schemas
 * without a validator (browser-safe): the prop shape of a block (text props, list props and their record fields,
 * object props), the defaults of required props, the Lucide names of the contract, events and slots, and a compact
 * summary for the model. Validation itself is props-gate.ts (Ajv 2020, strict), loaded lazily in the browser.
 *
 * Nothing here is hand-written block data: every name, type, enum and default comes from the published schema.
 */
import raw from "./props.json" with { type: "json" };

export type JsonSchema = Record<string, unknown>;

type CompactProps = {
	format: "buildy-props-compact";
	version: number;
	registry: string;
	propsVersion: string;
	digest: string;
	defs: Record<string, JsonSchema>;
	items: Record<string, { organism: string; events: string[]; slots: string[]; schema: JsonSchema; defs: string[] }>;
};

const props = raw as unknown as CompactProps;

/** The contract's shared $def of a Lucide icon name (an enum of the names the kit ships). */
const ICON_DEF = "lucideIcon";
/** Neutral placeholder of a required icon nobody filled; used only when the contract's enum contains it. */
const PLACEHOLDER_ICON = "circle-dot";
/** Strings the kit parses (Intl currency code, locale, link) need a valid value, not a label. */
const STRING_DEFAULTS: Record<string, string> = { currency: "USD", locale: "en", href: "#", id: "item" };

export const propsDigest: string = props.digest;
export const propsRegistry: string = props.registry;

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

/** Lucide icon names of the contract (the published `lucideIcon` enum). */
export function lucideIcons(): string[] {
	const def = props.defs[ICON_DEF];
	return Array.isArray(def?.enum) ? (def.enum as string[]) : [];
}

function isObject(value: unknown): value is Record<string, unknown> {
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
function valueOf(node: JsonSchema): JsonSchema {
	const target = deref(node);
	if (Array.isArray(target.anyOf)) {
		const branches = (target.anyOf as JsonSchema[]).filter((branch) => !isRefShape(branch));
		if (branches.length === 1) return valueOf(branches[0]!);
	}
	return target;
}

export type FieldKind = "text" | "icon" | "enum" | "number" | "boolean" | "list" | "object" | "other";

function kindOf(node: JsonSchema): FieldKind {
	if (refName(node) === ICON_DEF) return "icon";
	const value = valueOf(node);
	if (refName(value) === ICON_DEF) return "icon";
	if (Array.isArray(value.enum)) return "enum";
	if (value.type === "string") return "text";
	if (value.type === "number" || value.type === "integer") return "number";
	if (value.type === "boolean") return "boolean";
	if (value.type === "array") return "list";
	if (value.type === "object" && isObject(value.properties)) return "object";
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

/** "addToCart" -> "Add to cart": a readable placeholder for a required label the content does not fill. */
function humanize(name: string): string {
	const words = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function clone<T>(value: T): T {
	return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/** The smallest valid value of a required prop: the schema default, else the first enum value, else by type. */
function defaultFor(node: JsonSchema, name: string, depth: number): unknown {
	if (node.default !== undefined) return clone(node.default);
	const value = valueOf(node);
	if (value.default !== undefined) return clone(value.default);
	if (kindOf(node) === "icon") {
		const icons = lucideIcons();
		return icons.includes(PLACEHOLDER_ICON) ? PLACEHOLDER_ICON : icons[0];
	}
	if (Array.isArray(value.enum)) return clone(value.enum[0]);
	if (value.type === "string") return STRING_DEFAULTS[name] ?? humanize(name);
	if (value.type === "number" || value.type === "integer") return 0;
	if (value.type === "boolean") return false;
	if (value.type === "array") return [];
	if (value.type === "object" && depth < 8) return fill(value, {}, depth + 1);
	return undefined;
}

function fill(node: JsonSchema, current: unknown, depth: number): unknown {
	const value = valueOf(node);
	if (value.type === "array" && Array.isArray(current) && isObject(value.items)) {
		return current.map((entry) => fill(value.items as JsonSchema, entry, depth + 1));
	}
	if (value.type !== "object" || !isObject(current) || "$" in current || depth > 8) return current;
	const properties = isObject(value.properties) ? (value.properties as Record<string, JsonSchema>) : {};
	const required = Array.isArray(value.required) ? (value.required as string[]) : [];
	const out: Record<string, unknown> = {};
	for (const name of required) {
		if (current[name] !== undefined || !properties[name]) continue;
		const fallback = defaultFor(properties[name]!, name, depth);
		if (fallback !== undefined) out[name] = fallback;
	}
	for (const [name, inner] of Object.entries(current)) out[name] = properties[name] ? fill(properties[name]!, inner, depth + 1) : inner;
	return out;
}

/**
 * Required props (and required fields of every record and object present) filled from the schema: its `default`,
 * the first enum value, or the smallest value of the type. Values that are present are kept as they are, so the
 * validator still sees what the variant and the page content set.
 */
export function fillProps(item: string, value: Record<string, unknown>): Record<string, unknown> {
	const schema = props.items[item]?.schema;
	if (!schema) return value;
	return fill(schema, value, 0) as Record<string, unknown>;
}

function kindLabel(kind: FieldKind): string {
	return kind === "text" ? "" : `:${kind}`;
}

/**
 * Compact model view of a block's schema: the list prop the page rows become (`features[]: id title text icon href?`,
 * optional fields with `?`), the object props, and events / slots. Enums of layout axes are left to the variants
 * (each variant already names its axis values); the icon enum is listed once in catalogSources.icons.
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

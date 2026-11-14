/**
 * What a block's props schema says about new content: a readable placeholder for a required label, required props filled
 * from the schema (`fillProps`), a new list row, list value or map entry, the keys a map may take, and enum text coerced
 * to the schema's type. Reads the published schemas through `props-schema.ts`; nothing here is hand-written block data.
 */
import { cloneJson } from "@buildytech/page-contract";
import { SAMPLE_MINOR, isMoneyName } from "./money.ts";
import { PLACEHOLDER_ICON, STRING_DEFAULTS, isObject, kindOf, lucideIcons, props, schemaAt, valueOf, type JsonSchema } from "./props-schema.ts";

/**
 * An enum prop written as text (a form select, an agent patch) in the type the schema declares: `level` is 1 | 2, so "2"
 * becomes 2 (also true / false / null). A value that is not an enum member, or a prop that is not an enum, is returned as
 * it came: the props gate still rejects it with the allowed values.
 */
export function coerceEnumValue(item: string, pointer: string, value: unknown): unknown {
	if (typeof value !== "string") return value;
	const node = schemaAt(item, pointer);
	const options = node ? valueOf(node).enum : undefined;
	if (!Array.isArray(options) || options.includes(value)) return value;
	const match = options.find((option) => typeof option !== "string" && String(option) === value);
	return match === undefined ? value : match;
}

/**
 * A new row for the list prop at `pointer` (`/content/features`): every required field from the schema (defaults,
 * first enum value, readable placeholders "Title" / "Text", the placeholder icon), a fresh `id` when the row has one.
 * Null when the pointer is not a list of records.
 */
export function newPropsListRow(item: string, pointer: string, taken: readonly unknown[] = []): Record<string, unknown> | null {
	const node = schemaAt(item, pointer);
	if (!node) return null;
	const value = valueOf(node);
	if (value.type !== "array" || !isObject(value.items) || valueOf(value.items as JsonSchema).type !== "object") return null;
	const row = fill(value.items as JsonSchema, {}, 1, true);
	if (!isObject(row)) return null;
	if (typeof row.id === "string") {
		const ids = new Set(taken.map((entry) => (isObject(entry) ? entry.id : undefined)));
		let n = taken.length + 1;
		while (ids.has(`item-${n}`)) n += 1;
		row.id = `item-${n}`;
	}
	return row;
}

function plainEntry(entry: JsonSchema, n: number, taken: readonly unknown[]): string | number | boolean | undefined {
	if (Array.isArray(entry.enum)) {
		const members = entry.enum as unknown[];
		const free = members.find((member) => !taken.includes(member)) ?? members[0];
		return typeof free === "string" || typeof free === "number" || typeof free === "boolean" ? free : undefined;
	}
	if (entry.type === "number" || entry.type === "integer") return typeof entry.minimum === "number" ? entry.minimum : 0;
	if (entry.type === "boolean") return false;
	if (entry.type === "string") {
		const text = `Item ${n}`;
		return typeof entry.maxLength === "number" ? text.slice(0, entry.maxLength) : text;
	}
	return undefined;
}

/**
 * A new entry for the list of plain values at `pointer` (`/plan/features`): the first enum member not used yet, 0, false,
 * or a readable "Item n" for text (cut to the schema's maxLength). Undefined when the pointer is not a list of plain values.
 */
export function newPropsListValue(item: string, pointer: string, taken: readonly unknown[] = []): string | number | boolean | undefined {
	const node = schemaAt(item, pointer);
	if (!node) return undefined;
	const list = valueOf(node);
	if (list.type !== "array" || !isObject(list.items)) return undefined;
	return plainEntry(valueOf(list.items as JsonSchema), taken.length + 1, taken);
}

/** A new value for the free-form map at `pointer` (`/badges`), as a new list entry is made; undefined when it is not such a map. */
export function newPropsMapValue(item: string, pointer: string, taken: readonly unknown[] = []): string | number | boolean | undefined {
	const node = schemaAt(item, pointer);
	if (!node) return undefined;
	const map = valueOf(node);
	if (map.type !== "object" || isObject(map.properties) || !isObject(map.additionalProperties)) return undefined;
	return plainEntry(valueOf(map.additionalProperties as JsonSchema), taken.length + 1, taken);
}

/** The keys a page may write inside props (`propertyNames` of the page-spec v2 schema: a letter first, then letters, digits, `_`; 48 at most). */
export const PAGE_KEY_PATTERN = "^[A-Za-z][A-Za-z0-9_]{0,47}$";

/** Why a key cannot name an entry of a map (non-empty, unique, a key a page may write, matches the schema's pattern), or null when it can. */
export function mapKeyIssue(key: string, others: readonly string[], pattern?: string): "empty_key" | "duplicate_key" | "bad_key" | null {
	if (!key.trim()) return "empty_key";
	if (others.includes(key)) return "duplicate_key";
	if (key === "__proto__" || key === "constructor" || key === "prototype") return "bad_key";
	if (!new RegExp(PAGE_KEY_PATTERN).test(key)) return "bad_key";
	if (pattern) {
		try {
			if (!new RegExp(pattern, "u").test(key)) return "bad_key";
		} catch {
			return null;
		}
	}
	return null;
}

/** "addToCart" -> "Add to cart": a readable placeholder for a required label the content does not fill. */
export function humanizeName(name: string): string {
	const words = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The smallest valid value of a required prop: the schema default, else the first enum value, else by type. */
function defaultFor(node: JsonSchema, name: string, depth: number, blank: boolean, rows = 0): unknown {
	if (node.default !== undefined) return cloneJson(node.default);
	const value = valueOf(node);
	if (value.default !== undefined) return cloneJson(value.default);
	if (kindOf(node) === "icon") {
		const icons = lucideIcons();
		return icons.includes(PLACEHOLDER_ICON) ? PLACEHOLDER_ICON : icons[0];
	}
	if (Array.isArray(value.enum)) return cloneJson(value.enum[0]);
	if (value.type === "string") return STRING_DEFAULTS[name] ?? (blank && rows === 0 ? "" : humanizeName(name));
	if (value.type === "number" || value.type === "integer") return 0;
	if (value.type === "boolean") return false;
	if (value.type === "array") return rows > 0 && depth < 8 ? placeholderRows(value, name, depth, rows) : [];
	if (value.type === "object" && depth < 8) return fill(value, {}, depth + 1, blank, rows);
	return undefined;
}

/**
 * A new block's required list starts with a few neutral rows (English "Label 1", ISO currency, the neutral icon) so the
 * block shows something; the row schema decides the shape. Nested lists inside a row stay empty.
 */
function placeholderRows(list: JsonSchema, name: string, depth: number, rows: number): unknown[] {
	const count = Math.min(typeof list.maxItems === "number" ? list.maxItems : rows, Math.max(rows, typeof list.minItems === "number" ? list.minItems : 0));
	const items = isObject(list.items) ? list.items : null;
	const entry = items ? valueOf(items) : null;
	const word = humanizeName(name.replace(/s$/, ""));
	return Array.from({ length: count }, (_, index) => {
		const n = index + 1;
		if (!entry) return `${word} ${n}`;
		if (entry.type === "string") return Array.isArray(entry.enum) ? entry.enum[0] : `${word} ${n}`;
		if (entry.type !== "object") return defaultFor(items!, name, depth + 1, false);
		const row = fill(entry, {}, depth + 1, false);
		if (!isObject(row)) return row;
		const properties = isObject(entry.properties) ? entry.properties : {};
		for (const [field, value] of Object.entries(row)) {
			const schema = properties[field];
			if (field === "id") row[field] = `${name}-${n}`;
			else if (typeof value === "string" && value !== "" && isObject(schema) && kindOf(schema) === "text" && STRING_DEFAULTS[field] === undefined) row[field] = `${value} ${n}`;
		}
		return row;
	});
}

function fill(node: JsonSchema, current: unknown, depth: number, blank: boolean, rows = 0): unknown {
	const value = valueOf(node);
	if (value.type === "array" && Array.isArray(current) && isObject(value.items)) {
		return current.map((entry) => fill(value.items as JsonSchema, entry, depth + 1, blank));
	}
	if (value.type !== "object" || !isObject(current) || "$" in current || depth > 8) return current;
	const properties = isObject(value.properties) ? (value.properties as Record<string, JsonSchema>) : {};
	const required = Array.isArray(value.required) ? (value.required as string[]) : [];
	const out: Record<string, unknown> = {};
	for (const name of required) {
		if (current[name] !== undefined || !properties[name]) continue;
		const fallback = defaultFor(properties[name]!, name, depth, blank, rows);
		// A money prop beside a currency starts from a sample amount in minor units (not 0: "$0"); a blank write keeps 0.
		if (fallback === 0 && !blank && isMoneyName(name) && "currency" in properties) out[name] = SAMPLE_MINOR;
		else if (fallback !== undefined) out[name] = fallback;
	}
	for (const [name, inner] of Object.entries(current)) out[name] = properties[name] ? fill(properties[name]!, inner, depth + 1, blank, rows) : inner;
	return out;
}

/**
 * Required props (and required fields of every record and object present) filled from the schema: its `default`,
 * the first enum value, or the smallest value of the type. Values that are present are kept as they are, so the
 * validator still sees what the variant and the page content set.
 */
export function fillProps(item: string, value: Record<string, unknown>, options: { blank?: boolean; rows?: number } = {}): Record<string, unknown> {
	const schema = props.items[item]?.schema;
	if (!schema) return value;
	return fill(schema, value, 0, options.blank === true, options.rows ?? 0) as Record<string, unknown>;
}

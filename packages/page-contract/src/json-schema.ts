/**
 * Dependency-free JSON Schema (draft 2020-12) checker for the subset the published
 * page-spec / page-patch schemas use: $ref (local and absolute to a registered $id), allOf, anyOf,
 * oneOf, not, type, enum, const, pattern, minLength, maxLength, minimum, maximum, minItems, maxItems, items,
 * properties, required, additionalProperties. Annotation keywords (title, description, x-*) are ignored.
 * An unknown assertion keyword throws: the vendored schema must stay inside this subset.
 */

export type SchemaIssue = { path: string; keyword: string };
type Schema = Record<string, unknown> | boolean;

const ANNOTATIONS = new Set(["$schema", "$id", "$defs", "title", "description", "default", "examples"]);
const ASSERTIONS = new Set([
	"$ref", "allOf", "anyOf", "oneOf", "not", "type", "enum", "const", "pattern", "minLength", "maxLength",
	"minimum", "maximum", "minItems", "maxItems", "items", "properties", "required", "additionalProperties"
]);

function typeOf(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
	return typeof value;
}

function typeMatches(value: unknown, type: string): boolean {
	const actual = typeOf(value);
	return actual === type || (type === "number" && actual === "integer");
}

function equal(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export class SchemaRegistry {
	private readonly roots = new Map<string, Record<string, unknown>>();
	private readonly regex = new Map<string, RegExp>();

	add(schema: Record<string, unknown>): void {
		const id = schema.$id;
		if (typeof id !== "string" || !id) throw new Error("schema needs an $id");
		this.roots.set(id, schema);
	}

	/** Issues of `value` against `ref` (an $id, optionally with a #/json/pointer). Empty = valid. */
	check(value: unknown, ref: string): SchemaIssue[] {
		const out: SchemaIssue[] = [];
		const [base, schema] = this.resolve(ref, "");
		this.walk(value, schema, base, "$", out);
		return out;
	}

	private resolve(ref: string, currentBase: string): [string, Schema] {
		const hash = ref.indexOf("#");
		const base = hash === 0 ? currentBase : hash > 0 ? ref.slice(0, hash) : ref;
		const pointer = hash >= 0 ? ref.slice(hash + 1) : "";
		const root = this.roots.get(base);
		if (!root) throw new Error(`unknown schema ${base}`);
		let node: unknown = root;
		for (const raw of pointer.split("/").filter(Boolean)) {
			const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
			node = node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined;
		}
		if (node === undefined) throw new Error(`unresolved $ref ${ref}`);
		return [base, node as Schema];
	}

	private pattern(source: string): RegExp {
		let re = this.regex.get(source);
		if (!re) {
			re = new RegExp(source, "u");
			this.regex.set(source, re);
		}
		return re;
	}

	private walk(value: unknown, schema: Schema, base: string, path: string, out: SchemaIssue[]): void {
		if (schema === true) return;
		if (schema === false) {
			out.push({ path, keyword: "false" });
			return;
		}
		const fail = (keyword: string, at = path) => out.push({ path: at, keyword });
		const sub = (v: unknown, s: unknown, at: string): SchemaIssue[] => {
			const issues: SchemaIssue[] = [];
			this.walk(v, s as Schema, base, at, issues);
			return issues;
		};
		for (const key of Object.keys(schema)) {
			if (!ASSERTIONS.has(key) && !ANNOTATIONS.has(key) && !key.startsWith("x-")) {
				throw new Error(`unsupported schema keyword ${key}`);
			}
		}
		if (typeof schema.$ref === "string") {
			const [refBase, target] = this.resolve(schema.$ref, base);
			this.walk(value, target, refBase, path, out);
		}
		if (Array.isArray(schema.allOf)) for (const s of schema.allOf) out.push(...sub(value, s, path));
		if (Array.isArray(schema.anyOf) && !schema.anyOf.some((s) => sub(value, s, path).length === 0)) fail("anyOf");
		if (Array.isArray(schema.oneOf)) {
			const branches = schema.oneOf.map((s) => sub(value, s, path));
			const passing = branches.filter((issues) => issues.length === 0).length;
			if (passing !== 1) {
				// Report the issues of the closest branch so the caller gets a useful path.
				const closest = [...branches].sort((a, b) => a.length - b.length)[0] ?? [];
				out.push(...(passing === 0 ? closest : []), { path, keyword: "oneOf" });
			}
		}
		if (schema.not !== undefined && sub(value, schema.not, path).length === 0) fail("not");
		if (schema.type !== undefined) {
			const types = Array.isArray(schema.type) ? schema.type : [schema.type];
			if (!types.some((t) => typeMatches(value, String(t)))) {
				fail("type");
				return;
			}
		}
		if (Array.isArray(schema.enum) && !schema.enum.some((e) => equal(e, value))) fail("enum");
		if ("const" in schema && !equal(schema.const, value)) fail("const");
		if (typeof value === "string") {
			const length = [...value].length;
			if (typeof schema.minLength === "number" && length < schema.minLength) fail("minLength");
			if (typeof schema.maxLength === "number" && length > schema.maxLength) fail("maxLength");
			if (typeof schema.pattern === "string" && !this.pattern(schema.pattern).test(value)) fail("pattern");
		}
		if (typeof value === "number" && typeof schema.minimum === "number" && value < schema.minimum) fail("minimum");
		if (typeof value === "number" && typeof schema.maximum === "number" && value > schema.maximum) fail("maximum");
		if (Array.isArray(value)) {
			if (typeof schema.minItems === "number" && value.length < schema.minItems) fail("minItems");
			if (typeof schema.maxItems === "number" && value.length > schema.maxItems) fail("maxItems");
			if (schema.items !== undefined) value.forEach((item, i) => out.push(...sub(item, schema.items, `${path}[${i}]`)));
		}
		if (value && typeof value === "object" && !Array.isArray(value)) {
			const obj = value as Record<string, unknown>;
			const props = (schema.properties ?? {}) as Record<string, unknown>;
			if (Array.isArray(schema.required)) {
				for (const key of schema.required) if (!(String(key) in obj)) fail("required", `${path}.${String(key)}`);
			}
			for (const [key, v] of Object.entries(obj)) {
				if (key in props) out.push(...sub(v, props[key], `${path}.${key}`));
				else if (schema.additionalProperties === false) fail("additionalProperties", `${path}.${key}`);
				else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
					out.push(...sub(v, schema.additionalProperties, `${path}.${key}`));
				}
			}
		}
	}
}

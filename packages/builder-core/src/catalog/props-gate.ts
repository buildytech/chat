/**
 * Program-level props gate: the merged props of every registry block of a page (variant preset + page content +
 * schema defaults, organism.ts) must validate against the block's published JSON Schema 2020-12
 * (registry.buildy.tw/props/v0.json, pinned in props.json). Ajv 2020 in strict mode; each item schema is compiled on
 * first use. The browser imports this module lazily (it carries the validator); the runtime installs it at start.
 *
 * Errors are reduced to one issue per JSON Pointer, the most specific first (enum, required, type, ...); branches of
 * a reference shape (`{"$": ...}`, `{op, args}`) are dropped because page content never takes them.
 */
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import { propsSchemaFor, refShapeDefs } from "./props-schema.ts";
import { setPropsValidator, type PropsIssue } from "./provenance.ts";
import type { RegistryRender } from "./organism.ts";

const ajv = new Ajv2020({ strict: true, allErrors: true });
const compiled = new Map<string, ValidateFunction>();

function validatorFor(item: string): ValidateFunction | null {
	const cached = compiled.get(item);
	if (cached) return cached;
	const schema = propsSchemaFor(item);
	if (!schema) return null;
	const validate = ajv.compile(schema);
	compiled.set(item, validate);
	return validate;
}

const RANK: Record<string, number> = { enum: 0, const: 0, required: 1, type: 2, additionalProperties: 3, pattern: 4, not: 5 };

function insideRefShape(error: ErrorObject): boolean {
	const match = /#\/\$defs\/([^/]+)/.exec(error.schemaPath);
	return Boolean(match && refShapeDefs.has(match[1]!));
}

function valueAt(data: unknown, pointer: string): unknown {
	let current = data;
	for (const part of pointer.split("/").slice(1)) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part.replace(/~1/g, "/").replace(/~0/g, "~")];
	}
	return current;
}

/** Ajv errors -> one issue per pointer, the most specific keyword first, reference-shape branches dropped. */
export function propsIssues(errors: readonly ErrorObject[], data: unknown): PropsIssue[] {
	const best = new Map<string, ErrorObject>();
	for (const error of errors) {
		if (error.keyword === "anyOf" || error.keyword === "oneOf" || insideRefShape(error)) continue;
		const pointer = error.keyword === "required" ? `${error.instancePath}/${(error.params as { missingProperty: string }).missingProperty}` : error.instancePath;
		const seen = best.get(pointer);
		if (!seen || (RANK[error.keyword] ?? 9) < (RANK[seen.keyword] ?? 9)) best.set(pointer, error);
	}
	if (!best.size && errors.length) {
		const first = errors[0]!;
		best.set(first.instancePath, first);
	}
	return [...best.entries()].map(([pointer, error]) => {
		const issue: PropsIssue = { pointer, keyword: error.keyword, message: error.message ?? error.keyword };
		if (error.keyword === "required") issue.message = "is required";
		else {
			const value = valueAt(data, pointer);
			if (value !== undefined && (typeof value !== "object" || value === null)) issue.value = value;
		}
		if (error.keyword === "enum") issue.allowed = (error.params as { allowedValues: unknown[] }).allowedValues;
		if (error.keyword === "additionalProperties") issue.message = `has no prop ${(error.params as { additionalProperty: string }).additionalProperty}`;
		return issue;
	});
}

/** Issues of the merged props of one registry block; [] when they match the published schema. */
export function validateRegistryProps(render: RegistryRender): PropsIssue[] {
	const validate = validatorFor(render.item);
	if (!validate) return [{ pointer: "", keyword: "schema", message: `registry item ${render.item} has no published props schema` }];
	if (validate(render.props)) return [];
	return propsIssues(validate.errors ?? [], render.props);
}

export function installPropsGate(): void {
	setPropsValidator(validateRegistryProps);
}

installPropsGate();

/**
 * The one gate of a page-spec/v2 document (ADR 0034): the published schema, the program checks, then the registry
 * checks (item exists and renders, variant is published, props pass the item's props schema, header-like items first
 * and footer-like items last). A failure is a list of compiler-style `{ path, code, expected, got }` that name where
 * (a JSON Pointer into the document), what the registry wanted and what was written, so an agent fixes its own document.
 */
import { closestIconNames } from "../icon-name.ts";
import { pageV2Issues, pageV2ProgramIssues, type PageV2, type SchemaIssue } from "@buildytech/page-contract";
import { validateItemProps } from "../catalog/provenance.ts";
import { itemInfo, allItems } from "./items.ts";
import { effectiveProps } from "./render.ts";

export type DocIssue = { path: string; code: string; expected: string; got?: unknown };
export type DocGate = { ok: true; page: PageV2 } | { ok: false; issues: DocIssue[] };

/** JSON Pointer of a `$.blocks[1].props.title` path of the schema walker. */
export function pointerOfSchemaPath(path: string): string {
	return (
		"/" +
		path
			.replace(/^\$\.?/, "")
			.replace(/\[(\d+)\]/g, ".$1")
			.split(".")
			.filter(Boolean)
			.map((part) => part.replace(/~/g, "~0").replace(/\//g, "~1"))
			.join("/")
	).replace(/\/$/, "") || "/";
}

export function valueAtPointer(data: unknown, pointer: string): unknown {
	let current = data;
	for (const part of pointer.split("/").slice(1)) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part.replace(/~1/g, "/").replace(/~0/g, "~")];
	}
	return current;
}

function short(value: unknown): unknown {
	if (typeof value === "string") return value.length > 80 ? `${value.slice(0, 77)}...` : value;
	if (value && typeof value === "object") {
		const text = JSON.stringify(value);
		return text.length > 120 ? `${text.slice(0, 117)}...` : value;
	}
	return value;
}

function schemaIssue(issue: SchemaIssue, doc: unknown): DocIssue {
	const path = pointerOfSchemaPath(issue.path);
	const inProps = /^\/blocks\/\d+\/props(\/|$)/.test(path);
	const expected =
		issue.expected ?? (inProps ? "a plain-text string, number, boolean, null, list or object whose keys are prop names (no markup, no { } < >)" : `a value the page-spec/v2 schema accepts (${issue.keyword})`);
	return { path, code: "schema_invalid", expected, got: issue.keyword === "required" ? undefined : short(valueAtPointer(doc, path)) };
}

/** Allowed values of a props enum, cut for a long list (Lucide icons). */
function allowedText(allowed: unknown[] | undefined, value?: unknown): string {
	if (!allowed?.length) return "";
	if (allowed.length > 40 && typeof value === "string" && value) {
		const near = closestIconNames(value);
		return `one of ${allowed.length} Lucide icon names; "${value}" is not one${near.length ? `, nearest: ${near.join(", ")}` : ""}; any other real name works (e.g. house, star, utensils, truck)`;
	}
	const shown = allowed.slice(0, 12).map(String).join(" | ");
	return allowed.length > 12 ? `one of ${allowed.length} values, e.g. ${shown}` : `one of ${shown}`;
}

const GATE_MISSING: DocIssue = { path: "/", code: "props_gate_unavailable", expected: "the props schema gate to be loaded", got: undefined };

/** Registry and chrome checks of a schema-valid page. */
export function registryIssues(page: PageV2): DocIssue[] {
	const out: DocIssue[] = [];
	page.blocks.forEach((block, index) => {
		const at = `/blocks/${index}`;
		const info = itemInfo(block.item);
		if (!info) {
			const near = allItems().filter((name) => name.includes(block.item) || block.item.includes(name)).slice(0, 6);
			out.push({ path: `${at}/item`, code: "unknown_item", expected: `a registry item that renders (search_catalog, get_block name them)${near.length ? `; similar: ${near.join(", ")}` : ""}`, got: block.item });
			return;
		}
		if (block.variant !== undefined && !info.variants.includes(block.variant)) {
			out.push({ path: `${at}/variant`, code: "unknown_variant", expected: `one of ${info.variants.join(" | ")}`, got: block.variant });
		}
		const issues = validateItemProps(block.item, effectiveProps(block.item, block.variant, block.props));
		if (issues === null) {
			out.push({ ...GATE_MISSING, path: `${at}/props` });
			return;
		}
		for (const issue of issues.slice(0, 8)) {
			out.push({
				path: `${at}/props${issue.pointer}`,
				code: "props_invalid",
				expected: issue.allowed?.length ? allowedText(issue.allowed, issue.value) : `${issue.message} (props schema of ${block.item})`,
				got: issue.keyword === "required" ? undefined : issue.value
			});
		}
	});
	// Header-like items first, footer-like items last (role from the registry metadata of the item).
	let top = 0;
	while (top < page.blocks.length && itemInfo(page.blocks[top]!.item)?.edge === "top") top += 1;
	let bottom = page.blocks.length;
	while (bottom > top && itemInfo(page.blocks[bottom - 1]!.item)?.edge === "bottom") bottom -= 1;
	page.blocks.forEach((block, index) => {
		const edge = itemInfo(block.item)?.edge;
		if (edge === "top" && index >= top) out.push({ path: `/blocks/${index}`, code: "header_not_first", expected: "header-like items (site-header, side navigation) before every section", got: block.item });
		if (edge === "bottom" && index < bottom) out.push({ path: `/blocks/${index}`, code: "footer_not_last", expected: "footer-like items (footer, bottom navigation) after every section", got: block.item });
	});
	return out;
}

/** Schema + program + registry checks of a document (no normalization: see writePage). */
export function checkPageDoc(input: unknown): DocGate {
	const schema = pageV2Issues(input);
	if (schema.length) return { ok: false, issues: schema.slice(0, 12).map((issue) => schemaIssue(issue, input)) };
	const page = input as PageV2;
	const program = pageV2ProgramIssues(page);
	if (program.length) return { ok: false, issues: program.slice(0, 12).map((issue) => ({ path: pointerOfSchemaPath(issue.path), code: issue.keyword, expected: issue.expected ?? issue.keyword, got: undefined })) };
	const issues = registryIssues(page);
	return issues.length ? { ok: false, issues: issues.slice(0, 16) } : { ok: true, page };
}

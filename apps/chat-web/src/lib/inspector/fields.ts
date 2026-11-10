/**
 * Presentation helpers of the inspector field model (builder-core inspectorModel): DOM ids, which fields carry page
 * content, and close Lucide names for a rejected icon. Pure functions, no Svelte.
 */
import type { InspectorField } from "@buildytech/builder-core";

/** A stable DOM id for a field of a block (`insp-block-hero-title`). */
export function fieldDomId(blockId: string, pointer: string): string {
	return `insp-${blockId}${pointer}`.replace(/[^A-Za-z0-9_-]+/g, "-");
}

/** The field (or a field inside it) is page content or has a rendered value. */
export function hasContent(field: InspectorField): boolean {
	if (field.origin) return true;
	if (field.widget === "object") return (field.fields ?? []).some(hasContent);
	if (field.widget === "list") return (field.rows?.length ?? 0) > 0;
	return field.value !== undefined && field.value !== null && field.value !== "";
}

/** Fields with content first (schema order kept); unset read-only props go to a collapsed group. */
export function partitionFields(fields: readonly InspectorField[]): { main: InspectorField[]; more: InspectorField[] } {
	const main: InspectorField[] = [];
	const more: InspectorField[] = [];
	for (const field of fields) (hasContent(field) ? main : more).push(field);
	return { main, more };
}

function distance(a: string, b: string): number {
	const row = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i += 1) {
		let prev = row[0]!;
		row[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			const next = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
			prev = row[j]!;
			row[j] = next;
		}
	}
	return row[b.length]!;
}

/** Allowed values closest to what was typed: prefix matches, then substrings, then by edit distance. */
export function closestAllowed(value: string, allowed: readonly string[], limit = 8): string[] {
	const query = value.trim().toLowerCase();
	if (!query) return allowed.slice(0, limit);
	const rank = (name: string): number => {
		if (name.startsWith(query)) return 0;
		if (name.includes(query)) return 1;
		return 2 + distance(query, name);
	};
	return [...allowed].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, limit);
}

/** A rejected edit shown in its field: the gate's message and, for an enum, the allowed values. */
export type FieldIssue = { pointer: string; code: string; message: string; allowed?: string[]; value?: string };

/** Host callbacks of the field widgets: `typing` edits coalesce into one undo step until `onseal` (blur). */
export type FieldHandlers = {
	onedit: (field: InspectorField, value: string, typing: boolean) => void;
	onseal: () => void;
	/** Page rows of a list (row origin `children[i]`): duplicate or remove row `index`. */
	onrow?: (index: number, action: "duplicate" | "remove") => void;
};

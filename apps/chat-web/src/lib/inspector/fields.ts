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
export function partitionFields(fields: readonly InspectorField[], placed?: Map<string, "main" | "more">): { main: InspectorField[]; more: InspectorField[] } {
	const main: InspectorField[] = [];
	const more: InspectorField[] = [];
	for (const field of fields) {
		// A field keeps the group it was first shown in while its block stays selected: typing the first character
		// into an empty "More" field (or clearing a shown one) must not remount the control and drop focus.
		const where = placed?.get(field.pointer) ?? (hasContent(field) ? "main" : "more");
		placed?.set(field.pointer, where);
		(where === "main" ? main : more).push(field);
	}
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
	/** A variant axis select picked a value: switch the block to this named variant (set_variant). */
	onvariant?: (variant: string) => void;
	/** A list prop: add a row, or remove / move row `row` (page rows or a props override list). */
	onlist?: (pointer: string, action: "add" | "remove" | "up" | "down", row?: number) => void;
	/** Page rows of a list (row origin `children[i]`): duplicate or remove row `index`. */
	onrow?: (index: number, action: "duplicate" | "remove") => void;
};

/** Classes of a locked control: muted (UI8Kit tokens), not-allowed cursor; it never looks like a live input. */
export const LOCKED_CONTROL = "cursor-not-allowed bg-muted text-muted-foreground";

/**
 * The message key of the hint under a field (null: none). A locked field says why; a field written to the block props
 * says it overrides the variant, or where its value comes from until then (a variant preset, a schema placeholder).
 * A variant axis says how its select works.
 */
export function lockHint(field: InspectorField): string | null {
	if (field.origin) return null;
	if (field.choices && field.prop) return field.overridden ? "inspector.prop.axisOverridden" : "inspector.prop.axis";
	if (field.prop) {
		if (field.overridden) return "inspector.prop.overridden";
		if (field.from === "variant") return "inspector.prop.variant";
		if (field.from === "sample") return "inspector.prop.sample";
		return "inspector.prop.unset";
	}
	switch (field.lock) {
		case "variant":
			if (field.choices) return axisSwitchable(field) ? "inspector.lock.axis" : "inspector.lock.axisNone";
			return "inspector.lock.variant";
		case "sample":
			return "inspector.lock.sample";
		case "no_page_field":
			return "inspector.lock.noField";
		default:
			return null;
	}
}

function axisSwitchable(field: InspectorField): boolean {
	return Boolean(field.choices?.some((choice) => choice.variant && choice.value !== String(field.value ?? "")));
}

/** Whether a variant axis select is live: it can override the axis (props), or another value has a named variant. */
export function axisSwitch(field: InspectorField, canSwitch: boolean): boolean {
	return canSwitch && (Boolean(field.prop) || axisSwitchable(field));
}

/**
 * What picking `value` on a variant axis does: switch to the named variant of that combination when there is one
 * (and it is not the current variant), else write the axis as a props override.
 */
export function axisAction(field: InspectorField, value: string, current: string): { variant: string } | { override: string } | null {
	const target = field.choices?.find((choice) => choice.value === value)?.variant;
	if (target && target !== current) return { variant: target };
	return field.prop ? { override: value } : null;
}

/** The text of a rejected edit: a known code reads from the dictionary, anything else is the gate's own message. */
export function issueText(issue: FieldIssue, t: (key: string) => string): string {
	if (issue.code === "link_invalid") return t("inspector.linkInvalid").replace("{value}", issue.value ?? "");
	if (issue.code === "props_invalid") return `${t("inspector.propsInvalid")} ${issue.message}`;
	return issue.message;
}

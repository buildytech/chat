/**
 * A proposal as the author reads it (ADR 0034): one row per entry of the diff against the page they see, block by
 * block (added, removed, moved, props changed) and the page fields. Generated from the diff, never from model text.
 * Pure: no DOM, no runes; `t` is passed in.
 */
import { itemInfo, type DiffEntry } from "@buildytech/builder-core";

type T = (key: string) => string;

export type DiffRowKind = "added" | "removed" | "moved" | "changed" | "page";
export type DiffRow = { kind: DiffRowKind; id: string | null; text: string };

const name = (entry: DiffEntry): string => {
	const title = entry.item ? (itemInfo(entry.item)?.title ?? entry.item) : (entry.id ?? "");
	return entry.variant ? `${title} / ${entry.variant}` : title;
};

/** Props pointers shown for one changed block: the first few, then a count. */
function pathsText(paths: readonly string[] | undefined): string {
	const list = paths ?? [];
	if (!list.length) return "";
	const shown = list.slice(0, 4).join(", ");
	return list.length > 4 ? `${shown} +${list.length - 4}` : shown;
}

export function diffRows(diff: readonly DiffEntry[], t: T): DiffRow[] {
	return diff.map((entry): DiffRow => {
		if (entry.scope === "page") return { kind: "page", id: null, text: t("diff.page").replace("{list}", pathsText(entry.paths)) };
		const id = entry.id ?? null;
		switch (entry.change) {
			case "added":
				return { kind: "added", id, text: t("diff.added").replace("{block}", name(entry)) };
			case "removed":
				return { kind: "removed", id, text: t("diff.removed").replace("{block}", name(entry)) };
			case "moved":
				return { kind: "moved", id, text: t("diff.moved").replace("{block}", name(entry)).replace("{from}", String((entry.from ?? 0) + 1)).replace("{to}", String((entry.to ?? 0) + 1)) };
			default:
				return { kind: "changed", id, text: t("diff.changed").replace("{block}", name(entry)).replace("{list}", pathsText(entry.paths)) };
		}
	});
}

/** The diff as text lines (history, tests): one line per row, or the "no change" line. */
export function diffText(diff: readonly DiffEntry[], t: T): string {
	const rows = diffRows(diff, t);
	return rows.length ? rows.map((row) => `- ${row.text}`).join("\n") : t("diff.none");
}

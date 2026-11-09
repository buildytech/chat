import type { PageBlock } from "@buildytech/page-contract";

/**
 * Display helpers for data rows (metric tiles, chart points, activity rows).
 * Static class lists so Tailwind sees every height; no inline style (UI8Kit rule 03).
 */
export const BAR_HEIGHTS = ["h-2", "h-4", "h-8", "h-12", "h-16", "h-20", "h-24", "h-28", "h-32"] as const;

/** First number in a display value: "1 280" -> 1280, "94%" -> 94, "3,5 h" -> 3.5. */
export function numericValue(value: string | undefined | null): number | null {
	if (!value) return null;
	const match = value.replace(/\s+/g, "").match(/-?\d+(?:[.,]\d+)?/);
	if (!match) return null;
	const n = Number(match[0].replace(",", "."));
	return Number.isFinite(n) ? n : null;
}

/** Height class for a chart point relative to the largest sibling. */
export function barHeightClass(child: PageBlock, siblings: PageBlock[]): string {
	const max = Math.max(0, ...siblings.map((row) => numericValue(row.copy?.value) ?? 0));
	const value = numericValue(child.copy?.value) ?? 0;
	if (max <= 0 || value <= 0) return BAR_HEIGHTS[0];
	const step = Math.max(1, Math.round((value / max) * (BAR_HEIGHTS.length - 1)));
	return BAR_HEIGHTS[Math.min(step, BAR_HEIGHTS.length - 1)]!;
}

export type ItemView = "tile" | "row" | "bar" | "link" | "plain";

export function itemViewFor(parentKind: PageBlock["kind"]): ItemView {
	if (parentKind === "overview" || parentKind === "metrics") return "tile";
	if (parentKind === "activity") return "row";
	if (parentKind === "chart") return "bar";
	if (parentKind === "sidenav" || parentKind === "bottomnav") return "link";
	return "plain";
}

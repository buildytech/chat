/** The first reason a write was rejected, in short plain words of the interface language (never the model-facing text); `t` is the dictionary lookup. */

type Say = (key: string) => string;

export type RejectedIssue = { path: string; code: string; expected: string; got?: unknown };

const clip = (value: unknown): string => {
	const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
	return text.length > 40 ? `${text.slice(0, 37)}...` : text;
};

/** `/blocks/3/props/quotes/2/mark` as "block 4, quotes 3 mark": block and row numbers count from 1. */
function whereOf(path: string, t: Say): string {
	const hit = /^\/blocks\/(\d+)(?:\/props)?((?:\/.*)?)$/.exec(path);
	if (!hit) return path || "/";
	const field = hit[2]!.split("/").filter(Boolean).map((part) => (/^\d+$/.test(part) ? String(Number(part) + 1) : part)).join(" ");
	return t("run.reason.at").replace("{block}", String(Number(hit[1]) + 1)).replace("{field}", field).replace(/,\s*$/, "").trim();
}

function whatOf(issue: RejectedIssue, t: Say): string {
	const got = clip(issue.got);
	if (/Lucide icon names?/.test(issue.expected)) return t("run.reason.icon").replace("{got}", got);
	if (/^has no prop /.test(issue.expected)) return t("run.reason.unknownProp");
	if (issue.code === "unknown_item") return t("run.reason.unknownItem").replace("{got}", got);
	if (issue.code === "unknown_variant") return t("run.reason.unknownVariant").replace("{got}", got);
	if (issue.got === undefined) return t("run.reason.missing");
	return t("run.reason.value").replace("{got}", got);
}

/** "First problem: block 4, quotes 3 mark: "smile" is not an icon name.", or "" without an issue. */
export function firstReason(issues: readonly RejectedIssue[] | undefined, t: Say): string {
	const first = issues?.[0];
	return first ? t("run.reason").replace("{where}", whereOf(first.path, t)).replace("{what}", whatOf(first, t)) : "";
}

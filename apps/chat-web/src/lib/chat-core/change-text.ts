/**
 * Reply text of a Build proposal, generated from what the proposal actually changes (ADR 0020): blocks by title and
 * catalog block, variant swaps, the rest unchanged, and the plan ops that were not applied with their reason. Pure:
 * no DOM, no runes; `t` is passed in.
 */
import { isPlanNoop, type BlockRef, type PageChangeReport, type PagePlan } from "@buildytech/builder-core";

type T = (key: string) => string;

const ref = (row: BlockRef) => `${row.title} (${row.name})`;

export function changeReportText(
	report: PageChangeReport,
	t: T,
	opts: { title: string; fresh: boolean; screen?: string | null; missing?: string[] }
): string {
	const lines: string[] = [];
	if (opts.fresh) {
		lines.push(
			t("change.newPage")
				.replace("{title}", opts.title)
				.replace("{n}", String(report.added.length))
				.replace("{screen}", opts.screen ?? t("preview.noScreen"))
		);
		lines.push(t("change.blocks").replace("{list}", report.added.map(ref).join(", ")));
	} else {
		lines.push(t("change.proposal").replace("{title}", opts.title));
		for (const row of report.changed) {
			const parts: string[] = [];
			if (row.block) parts.push(t("change.block").replace("{from}", row.block.from ?? "-").replace("{to}", row.block.to ?? "-"));
			if (row.variant) parts.push(t("change.variant").replace("{from}", row.variant.from ?? t("ask.default")).replace("{to}", row.variant.to ?? t("ask.default")));
			for (const field of row.fields) if (!(field === "block" && row.block)) parts.push(t(`change.field.${field}`));
			lines.push(t("change.changed").replace("{block}", ref(row)).replace("{what}", parts.join(", ")));
		}
		if (report.added.length) lines.push(t("change.added").replace("{list}", report.added.map(ref).join(", ")));
		if (report.removed.length) lines.push(t("change.removed").replace("{list}", report.removed.map(ref).join(", ")));
		if (report.moved.length) lines.push(t("change.moved").replace("{list}", report.moved.map(ref).join(", ")));
		if (report.pageFields.length) lines.push(t("change.page").replace("{list}", report.pageFields.join(", ")));
		const nothing = !report.changed.length && !report.added.length && !report.removed.length && !report.moved.length && !report.pageFields.length;
		if (nothing) lines.push(t("change.none"));
		if (report.kept.length) lines.push(t("change.kept").replace("{n}", String(report.kept.length)));
	}
	if (opts.missing?.length) lines.push(t("assistant.missingBlocks").replace("{list}", opts.missing.join(", ")));
	return lines.join("\n");
}

/** The ops of an executed plan that were not applied, one line each with the reason. */
export function planResultText(plan: PagePlan, t: T): string {
	const lines: string[] = [];
	const applied = plan.ops.filter((op) => op.result?.status === "applied").length;
	// No-ops (already on the page) are not counted as selected changes and never as rejected.
	const chosen = plan.ops.filter((op) => op.result && op.result.status !== "skipped").length;
	lines.push(t("plan.resultLine").replace("{applied}", String(applied)).replace("{n}", String(chosen)));
	for (const op of plan.ops) {
		if (op.result?.status === "applied" && op.dropped?.length) {
			lines.push(t("plan.droppedLine").replace("{op}", planOpText(op, t)).replace("{list}", op.dropped.join(", ")));
		}
		if (op.result?.status !== "rejected") continue;
		lines.push(
			t("plan.rejectedLine")
				.replace("{op}", planOpText(op, t))
				.replace("{code}", op.result.code ?? "")
				.replace("{message}", op.result.message ?? "")
		);
	}
	const kept = plan.ops.filter(isPlanNoop);
	if (kept.length) lines.push(t("plan.keptLine").replace("{list}", kept.map((op) => planOpText(op, t)).join("; ")));
	return lines.join("\n");
}

/** One plan op as the author reads it: what, on which block. */
export function planOpText(op: PagePlan["ops"][number], t: T): string {
	const block = op.label ?? op.blockId ?? op.kind ?? "";
	switch (op.op) {
		case "set_variant":
			return t("plan.op.set_variant").replace("{block}", block).replace("{from}", op.from ?? t("ask.default")).replace("{to}", op.variant ?? t("ask.default"));
		case "set":
			return t("plan.op.set").replace("{block}", block).replace("{field}", op.field ?? "").replace("{value}", op.value ?? "");
		case "set_items":
			return t("plan.op.set_items").replace("{block}", block).replace("{n}", String(op.items?.length ?? 0));
		case "add":
			if (op.catalogBlock) {
				const to = `${op.catalogBlock}${op.variant ? `/${op.variant}` : ""}`;
				return t("plan.op.addBlock").replace("{to}", to).replace("{title}", op.title ?? "");
			}
			return t("plan.op.add").replace("{kind}", op.kind ?? "").replace("{title}", op.title ?? "");
		case "replace":
			if (op.catalogBlock) {
				const to = `${op.catalogBlock}${op.variant ? `/${op.variant}` : ""}`;
				return t("plan.op.replaceBlock").replace("{block}", block).replace("{to}", to);
			}
			return t("plan.op.replace").replace("{block}", block).replace("{kind}", op.kind ?? "");
		case "remove":
			return t("plan.op.remove").replace("{block}", block);
		case "move":
			return t("plan.op.move").replace("{block}", block).replace("{to}", String((op.to ?? 0) + 1));
	}
	return op.op;
}

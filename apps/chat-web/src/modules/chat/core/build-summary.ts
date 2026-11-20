/**
 * The host's own summary line of a Build proposal (t85u step 5), worded from chat-agent buildSummaryFacts: what was
 * written, how many blocks, which gate errors the run fixed, the diff, and whether the request ran as edit-fields.
 * No model call.
 */
import type { DiffEntry } from "@buildytech/builder-core";
import { buildSummaryFacts, type RunTrace } from "@buildytech/chat-agent";
import type { PageV2 } from "@buildytech/page-contract";
import { t } from "../../../lib/i18n/dictionary";

function changes(diff: readonly DiffEntry[]): string {
	return diff
		.map((entry) => {
			const what = entry.scope === "page" ? t("summary.page") : `${entry.item ?? entry.id ?? "?"}${entry.variant ? ` ${entry.variant}` : ""}`;
			return `${what}: ${t(`summary.change.${entry.change}`)}${entry.paths?.length ? ` (${entry.paths.join(", ")})` : ""}`;
		})
		.join("; ");
}

export function buildSummary(input: { page: PageV2; diff: readonly DiffEntry[]; trace?: RunTrace; warnings: readonly string[] }): string {
	const facts = buildSummaryFacts(input.page, input.trace);
	const lines: string[] = [];
	if (facts.editFields) lines.push(t("summary.editFields"));
	lines.push(t("summary.written").replace("{title}", facts.title).replace("{count}", String(facts.blocks.length)).replace("{blocks}", facts.blocks.join(", ") || "—"));
	if (input.diff.length) lines.push(t("summary.changed").replace("{changes}", changes(input.diff)));
	lines.push(facts.fixed.length ? t("summary.gateFixed").replace("{count}", String(facts.fixed.length)).replace("{issues}", facts.fixed.join("; ")) : t("summary.gateClean"));
	if (input.warnings.length) lines.push(t("summary.notes").replace("{count}", String(input.warnings.length)));
	return lines.join("\n");
}

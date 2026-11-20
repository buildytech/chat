/**
 * The facts of the host's Build summary line (t85u step 5), from the checked proposal and the run trace, no model call:
 * the blocks written, the gate errors the run fixed (issues of the write_page calls rejected before the accepted one)
 * and whether the request ran as the edit-fields scenario (one selected block's props). The chat words them.
 */
import type { PageV2 } from "@buildytech/page-contract";
import type { RunTrace } from "./run-trace.ts";

export type BuildSummaryFacts = { editFields: boolean; title: string; blocks: string[]; fixed: string[]; rejectedWrites: number };

export function buildSummaryFacts(page: PageV2, trace: RunTrace | undefined): BuildSummaryFacts {
	const fixed: string[] = [];
	let rejectedWrites = 0;
	for (const result of trace?.toolResults ?? []) {
		if (result.name !== "write_page" || result.accepted !== false) continue;
		rejectedWrites += 1;
		for (const issue of result.gate?.issues ?? []) {
			const text = `${issue.code} ${issue.path}`;
			if (!fixed.includes(text)) fixed.push(text);
		}
	}
	return {
		editFields: trace?.scenario?.id === "page.edit-fields",
		title: page.title,
		blocks: page.blocks.map((block) => `${block.item}${block.variant ? ` ${block.variant}` : ""}`),
		fixed,
		rejectedWrites
	};
}

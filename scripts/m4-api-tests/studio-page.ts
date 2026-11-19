/** The test page of the simple line (ADR 0059): a studio's hero and team, the two catalog blocks, built through the page ops. */
import assert from "node:assert/strict";
import { applyOp, emptyPage } from "../../packages/builder-core/src/index.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";

export function studioPage(opts: { title?: string; locale?: string; now?: string; blocks?: ReadonlyArray<readonly [string, string]> } = {}): PageV2 {
	let page = emptyPage({ title: opts.title ?? "Quiet Rooms Studio", locale: opts.locale ?? "en", now: opts.now ?? "2026-11-19T12:00:00.000Z" });
	for (const [item, variant] of opts.blocks ?? [["hero-simple", "mediaEnd"], ["team-simple", "cols3"]]) {
		const r = applyOp(page, { op: "add", item, variant });
		assert.ok(r.ok, JSON.stringify(r));
		page = r.page;
	}
	return page;
}

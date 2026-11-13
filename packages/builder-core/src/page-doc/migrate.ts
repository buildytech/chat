/**
 * Migration page-spec/v1 -> page-spec/v2 (ADR 0034): the v1 block's copy slots, props overrides and children are merged
 * into the props its registry block already renders (`organismFor`, the code the preview and the export used), so the
 * v2 block renders exactly what the v1 block rendered. A v1 block without a registry block (the "Not in the registry"
 * stub) has no props to carry and is left out, said in `skipped`. Provenance and history are untouched.
 */
import type { Page, PageV2, BlockV2, PropValueV2 } from "@buildytech/page-contract";
import { organismFor } from "../catalog/organism.ts";

export type MigrationResult = { page: PageV2; skipped: Array<{ id: string; kind: string; reason: string }> };

export function migratePageV1(page: Page): MigrationResult {
	const skipped: MigrationResult["skipped"] = [];
	const blocks: BlockV2[] = [];
	for (const node of page.layout.blocks) {
		const render = organismFor(node);
		if (!render) {
			skipped.push({ id: node.id, kind: node.kind, reason: "no registry block" });
			continue;
		}
		blocks.push({ id: node.id, item: render.item, variant: render.variant, props: JSON.parse(JSON.stringify(render.props)) as Record<string, PropValueV2> });
	}
	const out: PageV2 = {
		version: 2,
		id: page.id,
		slug: page.slug,
		status: page.status,
		title: page.title,
		locale: page.locale,
		seo: { ...page.seo },
		createdAt: page.createdAt,
		updatedAt: page.updatedAt,
		blocks
	};
	return { page: out, skipped };
}

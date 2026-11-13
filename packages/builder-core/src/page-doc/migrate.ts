/**
 * Migration page-spec/v1 -> page-spec/v2 (ADR 0034): the v1 block's copy slots, props overrides and children are merged
 * into the props its registry block already renders (`organismFor`, the code the preview and the export used), so the
 * v2 block renders exactly what the v1 block rendered. A v1 block without a registry block (the "Not in the registry"
 * stub) has no props to carry and is left out, said in `skipped`. Provenance and history are untouched.
 */
import type { Page, PageV2, BlockV2, PropValueV2 } from "@buildytech/page-contract";
import { organismFor } from "../catalog/organism.ts";
import { humanizeName } from "../catalog/props-schema.ts";

/**
 * Texts the v1 host itself wrote into a block (not the author, not the model): the empty-draft notice, the caption of the
 * closing band. They were never page content; a 1.x page carries them in block summaries and copy, so they are cleared.
 */
const V1_SERVICE_TEXT = /^(?:Closing band\.|Contact facts are not invented|No data in this draft|\u0412 \u044d\u0442\u043e\u043c \u0447\u0435\u0440\u043d\u043e\u0432\u0438\u043a\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445)/i;

/**
 * v1 rendered a required text it had no content for as the humanized prop name ("Value", "By line", "Role"): the migrated
 * block keeps what the author's content says and clears those fill-ins, so the renderer shows nothing instead of a label
 * that reads as data. Stats rows of 1.x kept the figure in the row summary (`hint`): it is the value.
 */
export function healV1Props(item: string, value: unknown): unknown {
	return heal(item, value);
}

function heal(item: string, value: unknown, key = ""): unknown {
	if (typeof value === "string") return value === humanizeName(key) || V1_SERVICE_TEXT.test(value) ? "" : value;
	if (Array.isArray(value)) return value.map((entry) => heal(item, entry, key));
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [name, inner] of Object.entries(value)) out[name] = heal(item, inner, name);
		if (item === "stats-band" && "hint" in out && "value" in out && out.value === "" && typeof out.hint === "string" && out.hint !== "") {
			out.value = out.hint;
			out.hint = "";
		}
		return out;
	}
	return value;
}

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
		blocks.push({ id: node.id, item: render.item, variant: render.variant, props: heal(render.item, JSON.parse(JSON.stringify(render.props))) as Record<string, PropValueV2> });
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

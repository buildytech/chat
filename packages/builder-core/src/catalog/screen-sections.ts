/**
 * A Stock screen's sections the page can render (t150u): every slot of the screen whose catalog block has a page
 * section renderer for its variant (or, when that variant has none, the block's default), in screen order. Pure and
 * per screen: the Blocks feed reads it per card (Start page / drag a screen) on any result page, and a screen with
 * at least one such section can start a page or be dropped into one (sections it cannot render are listed, not
 * invented). Hard page rules (header first, footer last) apply when the sections are added.
 */
import type { PageBlockKind } from "@buildytech/page-contract";
import { CHILD_ONLY_KINDS } from "../assemble.ts";
import { registryItemFor } from "./organism.ts";
import { getScreenById } from "./search.ts";
import { catalogSnapshot } from "./snapshot.ts";
import { catalogSourceFor } from "./sources.ts";

export type ScreenSection = { catalogBlock: string; variant: string; kind: PageBlockKind };
export type ScreenSections = { sections: ScreenSection[]; missing: string[] };

const cache = new Map<string, ScreenSections>();

export function screenSections(screenId: string): ScreenSections {
	const hit = cache.get(screenId);
	if (hit) return hit;
	const screen = getScreenById(screenId);
	const out: ScreenSections = { sections: [], missing: [] };
	for (const slot of screen?.layout ?? []) {
		const entry = catalogSnapshot.blockIndex.find((row) => row.blockId === slot.block);
		const kind = entry?.available && entry.rendererCompatible && entry.rendererKind ? (entry.rendererKind as PageBlockKind) : null;
		const variant = !entry || !kind || CHILD_ONLY_KINDS.has(kind)
			? null
			: [slot.variant, catalogSourceFor(entry.spec)?.defaultVariant].find((want) => want && entry.variants.includes(want) && registryItemFor(entry.spec, want)) ?? null;
		if (entry && kind && variant) out.sections.push({ catalogBlock: entry.spec, variant, kind });
		else out.missing.push(slot.block);
	}
	if (screen) cache.set(screenId, out);
	return out;
}

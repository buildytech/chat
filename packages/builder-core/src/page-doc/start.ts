/**
 * Starting a page and dropping a Stock screen into one (ADR 0034). A Stock screen is a ranking hint and a list of
 * sections: each slot whose block has a registry item that renders becomes a block of the page document (id from the
 * item, registry sample props). Nothing else of the screen is carried: no copy, no family.
 */
import type { BlockV2, PageV2 } from "@buildytech/page-contract";
import { getScreenById } from "../catalog/search.ts";
import { catalogSnapshot } from "../catalog/snapshot.ts";
import { itemInfo, itemOfSpec } from "./items.ts";

export type ScreenItem = { item: string; variant: string };
export type ScreenItems = { items: ScreenItem[]; missing: string[] };

const cache = new Map<string, ScreenItems>();

/** The sections of a Stock screen the registry renders, in screen order; slots it cannot render are listed in `missing`. */
export function screenItems(screenId: string): ScreenItems {
	const hit = cache.get(screenId);
	if (hit) return hit;
	const screen = getScreenById(screenId);
	const out: ScreenItems = { items: [], missing: [] };
	for (const slot of screen?.layout ?? []) {
		const entry = catalogSnapshot.blockIndex.find((row) => row.blockId === slot.block);
		const item = entry?.available ? itemOfSpec(entry.spec) : null;
		const info = item ? itemInfo(item) : null;
		if (!item || !info) {
			out.missing.push(slot.block);
			continue;
		}
		out.items.push({ item, variant: slot.variant && info.variants.includes(slot.variant) ? slot.variant : info.defaultVariant });
	}
	if (screen) cache.set(screenId, out);
	return out;
}

/** The Stock screen an empty page starts on when the author named none: the marketing landing home. */
export const DEFAULT_START_SCREEN = "screen.theme-marketing-landing/home";

/** The `blocks` of a screen as page-patch `add` values (ids and sample props are filled by write_page). */
export function screenBlocks(screenId: string): Array<Pick<BlockV2, "item" | "variant">> {
	return screenItems(screenId).items.map(({ item, variant }) => ({ item, variant }));
}

/** An empty draft page (no blocks): the base of a first write. */
export function emptyPage(input: { title: string; locale?: string | null; now?: Date | string; id?: string }): PageV2 {
	const stamp = (input.now ? new Date(input.now) : new Date()).toISOString();
	const title = input.title.trim().slice(0, 160) || "New page";
	return {
		version: 2,
		id: input.id ?? "page-draft",
		slug: "home",
		status: "draft",
		title,
		locale: input.locale && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.locale) ? input.locale : "en",
		seo: { title: title.slice(0, 200), description: "" },
		createdAt: stamp,
		updatedAt: stamp,
		blocks: []
	};
}

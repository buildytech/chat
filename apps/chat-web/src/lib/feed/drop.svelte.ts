/**
 * Dropping a dragged feed card at a top-level slot (preview drop layer, Sections list): the reason it cannot go
 * there, and the drop itself as the inspector add operation at that slot (every gate, one undo step, no model call).
 */
import { addSlotCheck } from "@buildytech/builder-core";
import { t } from "$lib/i18n/dictionary";
import { canvas } from "$lib/inspector/canvas.svelte";
import { inspector } from "$lib/inspector/inspector.svelte";
import { blocksOf, getCurrentPage } from "$lib/page-store";
import { feedDrag } from "./drag.svelte";

/** Null when the dragged card may go to slot `at`, else the reason to show (computed now, from the item and the page). */
export function dropRefusal(at: number): string | null {
	const item = feedDrag.item;
	if (!item) return null;
	// A screen: its sections take the slot; header / footer go to their edge and ones the page has are skipped.
	if (item.type === "screen") return item.supported ? null : t("feed.why.screen_not_renderable");
	const check = inspector.canAdd(item.spec, item.variant);
	if (!check.ok) return t(`feed.why.${check.code}`).replace("{role}", item.role ?? "");
	const page = getCurrentPage();
	const slot = addSlotCheck(page ? blocksOf(page) : [], check.item, at);
	return slot.ok ? null : t(`dnd.why.${slot.code}`);
}

/** Drop the dragged card at slot `at`; the result goes to the feed status line. */
export async function dropAt(at: number): Promise<boolean> {
	const item = feedDrag.item;
	feedDrag.end();
	if (!item) return false;
	const done = await (item.type === "screen" ? inspector.addScreen(item.id, at) : inspector.add(item.spec, item.variant, at));
	const name = (key: string) => t(key).replace("{title}", item.title).replace("{variant}", item.variant).replace("{position}", String(at + 1));
	if (done.ok) {
		canvas.requestReveal(done.blockId);
		feedDrag.status = { ok: true, text: name(item.type === "screen" ? "dnd.droppedScreen" : "dnd.dropped") };
	} else feedDrag.status = { ok: false, text: t("feed.addFailed").replace("{message}", done.message) };
	return done.ok;
}

/** A refused drop: said in the feed status line, nothing changes. */
export function refuseDrop(reason: string): void {
	feedDrag.end();
	feedDrag.status = { ok: false, text: t("dnd.refused").replace("{reason}", reason) };
}

/**
 * Left panel and Blocks feed preferences (ADR 0024): the open tab and the feed view (1 or 2 columns), one value
 * `buildy:v1:feed` = `{ tab, columns }`. Pure, no Svelte. The page size never depends on the view: 8 cards are 8 rows
 * in one column or 4 rows in two.
 */
import { STORAGE_KEYS, type StorageLike } from "../browser/storage-v1.ts";

export const LEFT_TABS = ["blocks", "sections", "chat"] as const;
export type LeftTab = (typeof LEFT_TABS)[number];
export type FeedColumns = 1 | 2;
export type FeedPrefs = { tab: LeftTab; columns: FeedColumns };

/** Cards per feed page, the same in both views. */
export const FEED_PAGE_SIZE = 8;

export const defaultFeedPrefs = (): FeedPrefs => ({ tab: "chat", columns: 1 });

/** Known values only; anything else is the default (never throws). */
export function parseFeedPrefs(input: unknown): FeedPrefs {
	const rec = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
	const base = defaultFeedPrefs();
	return {
		tab: LEFT_TABS.includes(rec.tab as LeftTab) ? (rec.tab as LeftTab) : base.tab,
		columns: rec.columns === 2 ? 2 : 1
	};
}

export function loadFeedPrefs(store: StorageLike | null): FeedPrefs {
	const text = store?.getItem(STORAGE_KEYS.feed);
	if (!text) return defaultFeedPrefs();
	try {
		return parseFeedPrefs(JSON.parse(text));
	} catch {
		return defaultFeedPrefs();
	}
}

export function saveFeedPrefs(store: StorageLike | null, prefs: FeedPrefs): boolean {
	if (!store) return false;
	try {
		store.setItem(STORAGE_KEYS.feed, JSON.stringify(parseFeedPrefs(prefs)));
		return true;
	} catch {
		return false;
	}
}

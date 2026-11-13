/**
 * Build left panel state (ADR 0024): the open tab (Blocks / Sections / Chat) and the Blocks feed (query, filters,
 * page, view). Results come from the shared builder-core `stockSearch` (stock-search/v1), the same function as the
 * home Stock screens field. Adding a card is an inspector operation (`inspector.add`): page-spec, props and catalog
 * provenance gates, one undo step, no model call.
 */
import { deriveFamily, familyKinds, stockSearch, type StockSearchResult, type StockSearchType } from "@buildytech/builder-core";
import { getCurrentPage } from "../page-store/index.ts";
import { browserStorage } from "../browser/storage-v1.ts";
import { FEED_PAGE_SIZE, loadFeedPrefs, saveFeedPrefs, type FeedColumns, type FeedPrefs, type LeftTab } from "./prefs.ts";

export type FeedFilters = { type: StockSearchType | null; role: string | null; spec: string | null; site: string | null; variant: string | null };

function createFeed() {
	let prefs = $state<FeedPrefs>(loadFeedPrefs(browserStorage()));
	let q = $state("");
	let filters = $state<FeedFilters>({ type: "block", role: null, spec: null, site: null, variant: null });
	let page = $state(1);
	/** The tab shown for this chat when it differs from the remembered one (landingTab); never saved. */
	let landed = $state<LeftTab | null>(null);

	const persist = () => saveFeedPrefs(browserStorage(), prefs);

	return {
		get tab(): LeftTab {
			return landed ?? prefs.tab;
		},
		/** The author's choice: shown and remembered. */
		set tab(next: LeftTab) {
			landed = null;
			prefs = { ...prefs, tab: next };
			persist();
		},
		/** The remembered tab (the author's last choice). */
		get savedTab(): LeftTab {
			return prefs.tab;
		},
		/** Show `next` for the chat just opened without changing the remembered choice. */
		land(next: LeftTab): void {
			landed = next === prefs.tab ? null : next;
		},
		get columns(): FeedColumns {
			return prefs.columns;
		},
		set columns(next: FeedColumns) {
			prefs = { ...prefs, columns: next };
			persist();
		},
		/** The inspector slide-over over the preview (ADR 0024 step D); remembered across reloads. */
		get inspector(): boolean {
			return prefs.inspector;
		},
		set inspector(next: boolean) {
			if (prefs.inspector === next) return;
			prefs = { ...prefs, inspector: next };
			persist();
		},
		get q(): string {
			return q;
		},
		set q(next: string) {
			q = next;
			page = 1;
		},
		get filters(): FeedFilters {
			return filters;
		},
		/** Set one filter; a new spec clears the variant, and every change goes back to page 1. */
		setFilter<K extends keyof FeedFilters>(key: K, value: FeedFilters[K]): void {
			const next = { ...filters, [key]: value || null };
			if (key === "spec") next.variant = null;
			if (key === "type" && value === "screen") next.variant = null;
			filters = next;
			page = 1;
		},
		reset(): void {
			q = "";
			filters = { type: "block", role: null, spec: null, site: null, variant: null };
			page = 1;
		},
		get page(): number {
			return page;
		},
		set page(next: number) {
			page = Math.max(1, Math.round(next));
		},
		get result(): StockSearchResult {
			// ADR 0027: the page's screen family ranks its kinds first (advisory: nothing is filtered out).
			const current = getCurrentPage();
			const family = current ? deriveFamily(current.blocks) : null;
			return stockSearch({ q, ...filters, page, pageSize: FEED_PAGE_SIZE, boostRoles: family ? familyKinds(family) : null });
		}
	};
}

export const feed = createFeed();

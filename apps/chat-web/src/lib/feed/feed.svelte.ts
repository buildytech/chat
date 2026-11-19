/**
 * Build left panel state (ADR 0024, ADR 0059): the open tab (Blocks / Sections / Chat) and the Blocks feed (query,
 * category, view). Cards are the block variants of the catalog (builder-core `catalogSearch`), each drawn as its
 * prototype. Adding a card is an inspector operation (`inspector.add`): page-spec and props gates, one undo step,
 * no model call.
 */
import { catalogSearch, type CatalogResult } from "@buildytech/builder-core";
import { browserStorage } from "../browser/storage-v1.ts";
import { moduleTabs } from "../modules/registry.svelte.ts";
import { CORE_LEFT_TABS, loadFeedPrefs, saveFeedPrefs, type FeedColumns, type FeedPrefs, type LeftTab } from "./prefs.ts";

function createFeed() {
	let prefs = $state<FeedPrefs>(loadFeedPrefs(browserStorage()));
	let q = $state("");
	let category = $state<string | null>(null);
	/** The tab shown for this project when it differs from the remembered one (landingTab); never saved. */
	let landed = $state<LeftTab | null>(null);

	const persist = () => saveFeedPrefs(browserStorage(), prefs);

	return {
		get tab(): LeftTab {
			// A remembered tab of a module that is not loaded (chat off) shows Blocks.
			const shown = landed ?? prefs.tab;
			return (CORE_LEFT_TABS as readonly string[]).includes(shown) || moduleTabs().some((m) => m.id === shown) ? shown : "blocks";
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
		/** Show `next` for the project just opened without changing the remembered choice. */
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
		},
		get category(): string | null {
			return category;
		},
		set category(next: string | null) {
			category = next || null;
		},
		reset(): void {
			q = "";
			category = null;
		},
		get result(): CatalogResult {
			return catalogSearch({ q, category });
		}
	};
}

export const feed = createFeed();

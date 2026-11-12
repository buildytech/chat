/**
 * The inspector slide-over (ADR 0024 step D): open state (remembered in the Build panel prefs) and focus return.
 * A section or field picked in the preview, or a row picked in Sections, opens it on that section, so editing needs
 * no extra click. Escape and the close button close it; focus goes back to where it was when the panel opened, if
 * that element is still on the page.
 */
import { feed } from "$lib/feed/feed.svelte";

let opener: HTMLElement | null = null;
let request = $state(0);

export const inspectorPanel = {
 get request(): number { return request; },
	get open(): boolean {
		return feed.inspector;
	},
	/** Open on the current selection; `from` is where focus returns on close (default: the focused element). */
	show(from?: HTMLElement | null): void {
  request += 1;
		if (!feed.inspector) opener = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
		feed.inspector = true;
	},
	close(): void {
		if (!feed.inspector) return;
		feed.inspector = false;
		const back = opener;
		opener = null;
		// Only when focus was in the panel (it is gone now) or nowhere: never steal focus from the left panel.
		queueMicrotask(() => {
			const active = document.activeElement;
			if (back?.isConnected && (!active || active === document.body)) back.focus({ preventScroll: true });
		});
	},
	toggle(): void {
		if (feed.inspector) inspectorPanel.close();
		else inspectorPanel.show();
	}
};

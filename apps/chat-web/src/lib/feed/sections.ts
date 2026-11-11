/**
 * Sections list helpers (ADR 0024 step B): where a dragged section lands and where a keyboard move goes. Pure, no
 * Svelte, no DOM globals; the component passes the item boxes it measured.
 */

/** Final index (move semantics: remove at `from`, insert at the result) for a pointer at `y` over item boxes. */
export function dropIndex(boxes: ReadonlyArray<{ top: number; height: number }>, y: number, from: number): number {
	if (!boxes.length) return from;
	// The slot before the first item whose middle is below the pointer; past the last middle: the end.
	let slot = boxes.findIndex((box) => y < box.top + box.height / 2);
	if (slot < 0) slot = boxes.length;
	const to = slot > from ? slot - 1 : slot;
	return Math.min(Math.max(to, 0), boxes.length - 1);
}

/** Target of a one-step keyboard move, or null at the edge. */
export function stepIndex(index: number, delta: -1 | 1, length: number): number | null {
	const to = index + delta;
	return to < 0 || to >= length ? null : to;
}

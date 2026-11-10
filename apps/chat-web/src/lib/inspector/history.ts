/**
 * Local edit history of the Build inspector: page snapshots, one step per edit. Typing in one field is one step
 * (edits with the same key extend the open step) until the step is sealed (blur, another field, an operation, undo).
 * Pure, no Svelte; the store holds one instance per chat.
 */
export type HistoryStep<T> = { before: T; after: T; key: string | null };

export class EditHistory<T> {
	private past: HistoryStep<T>[] = [];
	private future: HistoryStep<T>[] = [];
	private open: string | null = null;
	private readonly limit: number;

	constructor(limit = 100) {
		this.limit = limit;
	}

	/** Record `before -> after`. With a key equal to the open step's key the open step is extended (coalesced typing). */
	record(before: T, after: T, key: string | null = null): void {
		this.future = [];
		const top = this.past.at(-1);
		if (key !== null && top && this.open === key && top.key === key) {
			top.after = after;
			return;
		}
		this.past.push({ before, after, key });
		if (this.past.length > this.limit) this.past.shift();
		this.open = key;
	}

	/** Close the open typing step: the next edit starts a new step. */
	seal(): void {
		this.open = null;
	}

	/** The state to restore (the open step is sealed first), or null when there is nothing to undo. */
	undo(): T | null {
		this.open = null;
		const step = this.past.pop();
		if (!step) return null;
		this.future.push(step);
		return step.before;
	}

	redo(): T | null {
		this.open = null;
		const step = this.future.pop();
		if (!step) return null;
		this.past.push(step);
		return step.after;
	}

	/** The state after the last recorded step: a page changed elsewhere (a chat proposal) no longer matches it. */
	head(): T | null {
		return this.past.at(-1)?.after ?? this.future.at(-1)?.before ?? null;
	}

	clear(): void {
		this.past = [];
		this.future = [];
		this.open = null;
	}

	get canUndo(): boolean {
		return this.past.length > 0;
	}

	get canRedo(): boolean {
		return this.future.length > 0;
	}
}

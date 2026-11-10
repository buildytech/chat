import type { AgentMode } from "./agent-tools.ts";
import { askBlockCard, type AskBlockCard } from "../catalog/details.ts";

export type { AskBlockCard };

/**
 * A model turn that answered in text and created no proposal: every Ask turn, and Build turns where the model only
 * talked. `blocks` are the catalog block specs the model read through tool results; hosts rebuild the cards from their
 * own pinned catalog (askBlockCards) and never trust card data from the wire.
 */
export type AgentTextReply = {
	ok: true;
	reply: "text";
	mode: AgentMode;
	text: string;
	blocks: string[];
};

export function isAgentTextReply(value: unknown): value is AgentTextReply {
	return Boolean(value && typeof value === "object" && (value as { reply?: unknown }).reply === "text" && (value as { ok?: unknown }).ok === true);
}

const MAX_TEXT = 12_000;
const MAX_CARDS = 6;

export function agentTextReply(mode: AgentMode, text: string, blocks: readonly string[]): AgentTextReply {
	return { ok: true, reply: "text", mode, text: text.trim().slice(0, MAX_TEXT), blocks: [...new Set(blocks)].slice(0, MAX_CARDS) };
}

/** Cards of the blocks a reply referenced, recomputed from the bundled catalog; unknown specs are dropped. */
export function askBlockCards(specs: readonly unknown[] | undefined): AskBlockCard[] {
	const out: AskBlockCard[] = [];
	for (const spec of specs ?? []) {
		if (typeof spec !== "string") continue;
		const card = askBlockCard(spec);
		if (card && !out.some((row) => row.spec === card.spec)) out.push(card);
		if (out.length >= MAX_CARDS) break;
	}
	return out;
}

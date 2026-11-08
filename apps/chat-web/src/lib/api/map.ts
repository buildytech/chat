import { parsePage, type Page } from "@buildytech/page-contract";
import type { ChatMessage, ChatSession, SessionSummary } from "../chat-core/types.ts";
import type { ServerMessage, ServerSession, TurnResponse } from "./gateway.ts";

export type SavedArtifact = {
	kind: "saved_page";
	pageId: string;
	slug: string;
	revision: number;
	files: string[];
};

function parseToolArtifact(content: string): SavedArtifact | null {
	try {
		const raw = JSON.parse(content) as {
			tool?: string;
			pageId?: string;
			revision?: number;
			slug?: string;
		};
		if (raw.tool !== "save_page" || !raw.pageId || !raw.slug || !raw.revision) return null;
		return {
			kind: "saved_page",
			pageId: raw.pageId,
			slug: raw.slug,
			revision: raw.revision,
			files: ["page.svelte"]
		};
	} catch {
		return null;
	}
}

/** Map server messages → UI messages. Tool saves become artifacts on the following assistant turn. */
export function mapMessages(server: ServerMessage[]): ChatMessage[] {
	const out: ChatMessage[] = [];
	let pendingArtifact: SavedArtifact | null = null;
	for (const m of server) {
		if (m.role === "tool") {
			pendingArtifact = parseToolArtifact(m.content) ?? pendingArtifact;
			continue;
		}
		if (m.role === "system") continue;
		if (m.role !== "user" && m.role !== "assistant") continue;
		const msg: ChatMessage = {
			id: m.id,
			role: m.role,
			text: m.content,
			createdAt: m.createdAt
		};
		if (m.role === "assistant" && pendingArtifact) {
			msg.artifacts = [pendingArtifact];
			pendingArtifact = null;
		}
		out.push(msg);
	}
	return out;
}

export function mapSessionSummary(s: ServerSession): SessionSummary {
	return {
		id: s.id,
		title: s.title?.trim() ? s.title : "New chat",
		updatedAt: s.updatedAt
	};
}

export function mapSession(s: ServerSession, messages: ServerMessage[]): ChatSession {
	return {
		id: s.id,
		title: s.title?.trim() ? s.title : "New chat",
		updatedAt: s.updatedAt,
		pageId: s.pageId,
		pageBound: s.pageBound,
		pageRevision: s.pageRevision,
		messages: mapMessages(messages)
	};
}

export function parseServerPage(raw: unknown): Page | null {
	if (raw == null) return null;
	try {
		return parsePage(raw);
	} catch {
		return null;
	}
}

export function pageFromTurn(turn: TurnResponse): Page | null {
	if (!turn.page?.page) return null;
	return parseServerPage(turn.page.page);
}

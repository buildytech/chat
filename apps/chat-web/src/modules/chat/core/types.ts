import type { DiffEntry } from "@buildytech/builder-core";
import type { AgentMode, RejectedWrite, RunUsage, SessionUsage } from "@buildytech/chat-agent";
import type { SessionRevisionEntry } from "@buildytech/page-contract/session";

export type ServerCapabilities = {
	runtime: string;
	mode: string;
	liveModel: boolean;
	live?: { requested?: boolean; provider?: string; model?: string };
	tools: string[];
	features?: Record<string, unknown>;
	note?: string;
};

export type CreatorRuntimeStatus = {
	mode: "live" | "mock" | "booting";
	capabilities: ServerCapabilities | null;
	error: string | null;
	canDelete: boolean;
	lastRequestId: string | null;
};

export type ChatRole = "user" | "assistant";

export type ProposalStatus = "pending" | "applied" | "discarded" | "superseded";

export type ChatProposalState = {
	applied: boolean;
	status?: ProposalStatus;
	source: string;
	liveModel: boolean;
	warnings: string[];
	missing: string[];
	title: string;
	/** Page language of this proposal (follows the author's request). */
	locale?: string;
	/** The page revision the proposal was made for. */
	baseRevision?: number;
	/** The proposal as a diff against the page the author saw: per block added, removed, moved, changed. */
	diff?: DiffEntry[];
};

export type ChatRunRecord = {
	requestedModelId: string;
	modelId: string;
	modelLabel: string;
	live: boolean;
	policyVersion: string;
	modelCatalogVersion: string;
	trialPolicyVersion: string;
	catalogDigest?: string;
	path?: string;
	tools?: string[];
	runId?: string;
	usage: RunUsage;
	/** A turn that ended without an accepted write: the last rejected write (first issues and the document), for diagnosis of an exported session (contract 1.11.0; small, no secrets). */
	rejected?: RejectedWrite;
};

export type ChatMessage = {
	id: string;
	role: ChatRole;
	text: string;
	createdAt: string;
	proposal?: ChatProposalState;
	run?: ChatRunRecord;
	selectedModelId?: string;
	/** Chat mode the message was sent or answered in (composer toggle). */
	mode?: AgentMode;
	/**
	 * A text answer with no proposal (every Ask turn, a Build turn where the model only talked): `text` is the model's
	 * Markdown, `blocks` the catalog block specs it read; the cards are rebuilt from the bundled catalog when shown.
	 */
	answer?: { blocks: string[] };
	/** Build proposals: the model's own words next to the proposal summary (Markdown). */
	modelText?: string;
};

/**
 * The chat's view of a project (the stored session document): the project fields plus `ext.chat` (messages, mode,
 * selected model, usage). The project store keeps the project; this view is derived from it (chat.svelte.ts).
 */
export type ChatSession = {
	runAttempts?: import("@buildytech/chat-agent").RunAttempts;
	runTraces?: Record<string, import("@buildytech/chat-agent").RunTrace>;
	/** baseHash of the pending Build proposals by message id (session ext `chat-proposal-base`, chat-local; t85u). */
	proposalBases?: Record<string, import("@buildytech/chat-agent").ProposalBase>;
	id: string;
	/** Key of the page record when it differs from `id` (session file 1.9.0). */
	projectId?: string;
	title: string;
	updatedAt: string;
	messages: ChatMessage[];
	pageId?: string;
	pageBound?: boolean;
	pageRevision?: number | null;
	selectedModelId?: string;
	usage?: SessionUsage;
	/** Ask or Build, picked in the composer and kept with this chat. */
	mode?: AgentMode;
	/** Skin of the page (registry item `theme-<skin>`, session 1.1.0 `skin`); null or absent is the default theme. */
	skin?: string | null;
	/** Revisions of the applied page, oldest first (session buildy:v1 history; ADR 0015). Last entry <= pageRevision. */
	history?: SessionRevisionEntry[];
};

export type SessionSummary = Pick<ChatSession, "id" | "title" | "updatedAt">;

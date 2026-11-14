import type { AgentMode, CatalogRefs, DiffEntry, RunUsage, ScenarioId, SessionUsage } from "@buildytech/builder-core";
import type { PageV2 } from "@buildytech/page-contract";
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

export type ChatArtifact = {
	kind: "saved_page";
	pageId: string;
	slug: string;
	revision: number;
	files: string[];
};

export type ProposalStatus = "pending" | "applied" | "discarded" | "superseded";

export type ChatProposalState = {
	applied: boolean;
	status?: ProposalStatus;
	source: string;
	liveModel: boolean;
	assembler?: string;
	warnings: string[];
	missing: string[];
	title: string;
	screenId?: string | null;
	/** Page language of this proposal (follows the author's request). */
	locale?: string;
	/** Author asked for demo data and the page carries marked demo rows. */
	demoData?: boolean;
	/** Program-generated from the pinned Stock catalog after validation. Persisted with the chat. */
	catalogRefs?: CatalogRefs;
	/**
	 * ask-card: Apply variant on an Ask block card; ask-proposal: the proposal of an Ask answer (kept in `page` while the
	 * message is Ask's) and its Apply in Build; ask-plan: a 1.4.0 plan (old chats only). None of them calls the model.
	 */
	origin?: "ask-card" | "ask-plan" | "ask-proposal";
	/** The page revision the proposal was made for (Apply in Build checks that the page did not move on). */
	baseRevision?: number;
	/** The proposal as a diff against the page the author saw: per block added, removed, moved, changed. */
	diff?: DiffEntry[];
	/** An Ask proposal's page document (Ask never touches the page store). */
	page?: PageV2;
	/** Follow-up turns: block kinds added, kept, and removed versus the base page. */
	changes?: { added: string[]; kept: string[]; removed: string[] };
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
};

export type ChatMessage = {
	id: string;
	role: ChatRole;
	text: string;
	createdAt: string;
	artifacts?: ChatArtifact[];
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
	/** A 1.4.0 page plan of an old Ask answer: kept in the chat file, shown as text only, never run (ADR 0034). */
	plan?: unknown;
};

/**
 * The chat's view of a project (the stored session document): the project fields plus `ext.chat` (messages, mode,
 * selected model, usage). The project store keeps the project; this view is derived from it (chat.svelte.ts).
 */
export type ChatSession = {
	id: string;
	/** Key of the page record when it differs from `id` (session file 1.9.0). */
	projectId?: string;
	title: string;
	updatedAt: string;
	messages: ChatMessage[];
	pageId?: string;
	pageBound?: boolean;
	pageRevision?: number | null;
	scenarioId?: ScenarioId | null;
	screenId?: string | null;
	selectedModelId?: string;
	usage?: SessionUsage;
	/** Ask or Build, picked in the composer and kept with this chat. */
	mode?: AgentMode;
	/** Skin of the page (registry item `theme-<skin>`, session 1.1.0 `skin`); null or absent is the default theme. */
	skin?: string | null;
	/** Revisions of the applied page, oldest first (session buildy:v1 history; ADR 0015). Last entry <= pageRevision. */
	history?: SessionRevisionEntry[];
	/** Stock collection the chat was opened from (session 1.3.0 `collection`): present items bound Build. */
	collection?: import("./collection").ChatCollection;
};

export type SessionSummary = Pick<ChatSession, "id" | "title" | "updatedAt">;

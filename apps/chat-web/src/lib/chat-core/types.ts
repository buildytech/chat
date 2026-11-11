import type { AgentMode, CatalogRefs, PagePlan, RunUsage, ScenarioId, SessionUsage } from "@buildytech/builder-core";
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
	/** ask-card: Apply variant on an Ask block card; ask-plan: Apply in Build on an Ask plan (no model call). */
	origin?: "ask-card" | "ask-plan";
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
	/** Ask answers: the checked page plan (session 1.4.0 `plan`, ADR 0020); its ops run with Apply in Build. */
	plan?: PagePlan;
};

export type ChatSession = {
	id: string;
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

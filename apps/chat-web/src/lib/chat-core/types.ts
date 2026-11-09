import type { RunUsage, ScenarioId, SessionUsage } from "@buildytech/builder-core";

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
};

export type SessionSummary = Pick<ChatSession, "id" | "title" | "updatedAt">;

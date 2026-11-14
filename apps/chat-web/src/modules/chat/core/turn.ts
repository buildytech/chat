/**
 * One agent turn of the chat (ADR 0034): what it starts from, the request, the reply message and the proposal the
 * reply carries, checked again against the page the author sees. No storage: the callers commit the messages.
 */
import { MODEL_CATALOG_VERSION, POLICY_VERSION, TRIAL_POLICY_VERSION, catalogProvenance, collectionBounds, collectionDraft, diffPages, emptyPage, writePage, type DiffEntry } from "@buildytech/builder-core";
import { formatChatModelChoice, getChatModel, mapChatRunRequest, scopeIssues, unknownUsage, aggregateSessionUsage, type AgentMode, type RunUsage } from "@buildytech/chat-agent";
import type { PageV2 } from "@buildytech/page-contract";
import { t } from "../../../lib/i18n/dictionary";
import { fetchXaiStatus, runXaiTurn, type TurnRequest, type XaiRunResponse } from "../browser/xai-client";
import { getSelectedModelId } from "../browser/models.svelte.ts";
import { getScreenId } from "../browser/onboarding.svelte.ts";
import type { StoredPageProvenance } from "../../../lib/browser/persist";
import { getEditBase, getPageRevision, setCandidatePage } from "../../../lib/page-store";
import { getSelectedProject } from "../../../lib/project/store.svelte.ts";
import { draftPageId } from "../../../lib/project/transitions.ts";
import type { Project } from "../../../lib/project/types.ts";
import { getSelectedSession } from "./chat.svelte.ts";
import { blockScope } from "./block-scope.svelte.ts";
import { conversationForTurn } from "./conversation";
import { collectionRequest } from "./collection";
import type { ChatMessage, ChatProposalState, ChatRunRecord, ChatSession } from "./types";

export const nowIso = (): string => new Date().toISOString();
export const uid = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;

export function blankPage(project: Pick<Project, "projectId"> | null): PageV2 {
	return emptyPage({ title: t("page.untitled"), locale: "en", id: draftPageId(project) });
}

/** The page the author sees (pending proposal, else applied page, else the last proposal kept after Discard), or null. */
export function shownPageOf(): PageV2 | null {
	return getEditBase()?.page ?? null;
}

export type TurnPlan = { request: Omit<TurnRequest, "modelId">; base: PageV2; shown: PageV2 };

/**
 * What a turn starts from (ADR 0034). The agent edits the page the author sees. A chat with no page starts from an empty
 * page, or, in a collection chat, from the draft of the collection (its first screen and required blocks) with the
 * empty page as what the author sees, so the diff reads as additions.
 */
export function planTurn(brief: string, mode: AgentMode): TurnPlan {
	const session = getSelectedSession();
	const shownBase = shownPageOf();
	const collection = mode === "build" ? collectionRequest(session?.collection) : null;
	const empty = blankPage(getSelectedProject());
	let base = shownBase ?? empty;
	const shown: PageV2 = shownBase ?? empty;
	if (!shownBase && collection) {
		const bounds = collectionBounds(collection);
		const draft = bounds ? collectionDraft(bounds, { title: session?.collection?.title ?? t("page.untitled"), locale: null }) : null;
		if (draft?.ok) base = { ...draft.page, id: empty.id };
	}
	const scope = shownBase ? blockScope.ids(session?.id) : [];
	return {
		base,
		shown,
		request: {
			brief,
			mode,
			screenId: getScreenId() ?? session?.screenId ?? null,
			expectedRevision: getPageRevision() ?? 0,
			currentPage: base,
			shownPage: base === shown ? null : shown,
			scopeBlockIds: scope,
			conversation: conversationForTurn(session?.messages ?? []),
			collectionRequest: collection
		}
	};
}

export function sessionUsageFrom(session: ChatSession, extra?: RunUsage) {
	const runs = session.messages.map((m) => m.run?.usage).filter((u): u is RunUsage => Boolean(u));
	if (extra) runs.push(extra);
	return aggregateSessionUsage(runs);
}

export function runRecord(opts: {
	modelId: string;
	live: boolean;
	usage: RunUsage;
	catalogDigest?: string;
	path?: string;
	tools?: string[];
	runId?: string;
}): ChatRunRecord {
	const model = getChatModel(opts.modelId);
	return {
		requestedModelId: opts.modelId,
		modelId: opts.modelId,
		modelLabel: model ? formatChatModelChoice(model) : opts.modelId,
		live: opts.live,
		policyVersion: POLICY_VERSION,
		modelCatalogVersion: MODEL_CATALOG_VERSION,
		trialPolicyVersion: TRIAL_POLICY_VERSION,
		catalogDigest: opts.catalogDigest ?? catalogProvenance().sourceDigest,
		path: opts.path,
		tools: opts.tools,
		runId: opts.runId,
		usage: opts.usage
	};
}

export type TurnOutcome = {
	result: XaiRunResponse | { ok: false; code: string; message: string };
	plan: TurnPlan;
	status: Awaited<ReturnType<typeof fetchXaiStatus>>;
	modelId: string;
	live: boolean;
	usage: RunUsage;
	path?: string;
	tools?: string[];
	runId?: string;
};

export async function runTurn(brief: string, mode: AgentMode, signal: AbortSignal): Promise<TurnOutcome> {
	const plan = planTurn(brief, mode);
	const status = await fetchXaiStatus(signal);
	const mapped = mapChatRunRequest(
		{ modelId: getSelectedModelId() },
		{ discoveredChatIds: status.models?.listed ? status.models.chatIds ?? [] : undefined, allowUnlistedTrial: !status.ready }
	);
	if (!mapped.ok) {
		return { result: { ok: false, code: mapped.code, message: mapped.message }, plan, status, modelId: mapped.requestedId, live: false, usage: unknownUsage("error", 0) };
	}
	if (!status.ready) {
		return {
			result: { ok: false, code: status.code || "xai_runtime_not_ready", message: runtimeNoteFor(status) },
			plan,
			status,
			modelId: mapped.request.modelId,
			live: false,
			usage: unknownUsage("error", 0)
		};
	}
	const live = await runXaiTurn({ ...plan.request, modelId: mapped.request.modelId }, signal);
	const usage = live.usage ?? unknownUsage(live.ok === false && (live.code === "aborted" || signal.aborted) ? "cancelled" : "error", 0);
	return {
		result: live,
		plan,
		status,
		modelId: mapped.request.modelId,
		live: Boolean(live.ok && (live.toolCallingProven || live.liveXai)),
		usage,
		path: live.path,
		tools: live.toolsUsed,
		runId: live.runId
	};
}

export function runtimeNoteFor(status: { ready?: boolean; code?: string }): string {
	if (status.ready) return t("runtime.xaiReady");
	if (status.code === "xai_api_key_missing") return t("runtime.xaiMissing");
	if (status.code === "xai_runtime_unreachable" || status.code === "xai_status_error") {
		return t("runtime.unreachable");
	}
	if (status.code) return t("runtime.notReady").replace("{code}", status.code);
	return t("runtime.unreachable");
}

/** Never show platform text (for example Vercel's "An error occurred with your deployment"). */
export function localizedRunError(code: string | undefined, message: string, modelId: string): string {
	const label = getChatModel(modelId)?.label ?? modelId;
	if (code === "runtime_timeout") return t("runtime.timeout").replace("{code}", code);
	if (code === "runtime_platform_error") return t("runtime.platformError").replace("{code}", code);
	if (code === "model_tools_unavailable" || code === "multi_agent_tools_unavailable") {
		return t("runtime.modelToolsUnavailable").replace("{label}", label);
	}
	if (code === "client_outdated") return t("runtime.clientOutdated");
	if (code === "model_too_slow") return t("runtime.modelTooSlow").replace("{label}", label);
	if (code === "tools_unsupported") return t("runtime.toolsUnsupported");
	if (code === "xai_runtime_unreachable") return t("runtime.unreachable");
	if (code === "aborted") return t("runtime.cancelled");
	return message;
}

export function provenanceFor(screenId: string | null): StoredPageProvenance {
	return { screenId, scenarioId: null, missing: [] };
}

export const diffKey = (diff: readonly unknown[]): string => JSON.stringify(diff);

/**
 * The proposal of a reply, checked again here against the page the author sees (never trusted as sent): the same write
 * gate (`writePage`, props gate loaded), the same selection scope, and the diff recomputed from the two documents.
 */
export function checkedProposal(plan: TurnPlan, raw: { page: unknown }): { ok: true; page: PageV2; diff: DiffEntry[]; warnings: string[] } | { ok: false; code: string; message: string } {
	const written = writePage(plan.base, { page: raw.page });
	if (!written.ok) {
		const first = written.issues[0];
		return { ok: false, code: first?.code ?? "write_invalid", message: `${first?.path ?? "/"}: ${first?.expected ?? written.message}` };
	}
	const scope = plan.request.scopeBlockIds;
	const outside = scopeIssues(diffPages(plan.base, written.page), scope);
	if (outside.length) return { ok: false, code: "outside_scope", message: t("proposal.outsideScope") };
	return { ok: true, page: written.page, diff: diffPages(plan.shown, written.page), warnings: written.warnings };
}

export function newProposalState(input: {
	page: PageV2;
	diff: DiffEntry[];
	warnings: string[];
	baseRevision: number;
	live: boolean;
	screenId: string | null;
	origin?: ChatProposalState["origin"];
	keepPage?: boolean;
}): ChatProposalState {
	return {
		applied: false,
		status: "pending",
		source: "write_page",
		liveModel: input.live,
		warnings: input.warnings,
		missing: [],
		title: input.page.title,
		screenId: input.screenId,
		locale: input.page.locale,
		baseRevision: input.baseRevision,
		diff: input.diff,
		...(input.origin ? { origin: input.origin } : {}),
		...(input.keepPage ? { page: input.page } : {})
	};
}

/**
 * The assistant message of a finished turn. A reply with a proposal is the same in both modes: the text, the diff card.
 * Build also shows the proposal in Preview as the pending candidate (Apply / Discard); Ask keeps the page in its message
 * and never touches the page: the card "Apply in Build" is its only way in.
 */
export function replyMessage(out: TurnOutcome): ChatMessage {
	const { result, plan, modelId, live, usage } = out;
	const run = runRecord({ modelId, live, usage, path: out.path, tools: out.tools, runId: out.runId });
	if (!result.ok) {
		return { id: uid("msg"), role: "assistant", text: localizedRunError(result.code, result.message, modelId), createdAt: nowIso(), run };
	}
	const mode: AgentMode = result.mode;
	const base = { id: uid("msg"), role: "assistant" as const, text: result.text, createdAt: nowIso(), mode, answer: { blocks: [...result.blocks] }, run };
	if (!result.proposal) return base;
	const checked = checkedProposal(plan, result.proposal);
	if (!checked.ok) {
		return { ...base, text: `${result.text}\n\n${t("proposal.rejected").replace("{code}", checked.code).replace("{message}", checked.message)}`.trim() };
	}
	if (!checked.diff.length) return base;
	const screenId = plan.request.screenId ?? null;
	const baseRevision = plan.request.expectedRevision;
	if (mode === "ask") {
		return { ...base, proposal: newProposalState({ ...checked, baseRevision, live, screenId, origin: "ask-proposal", keepPage: true }) };
	}
	setCandidatePage(checked.page, provenanceFor(screenId));
	return { ...base, proposal: newProposalState({ ...checked, baseRevision, live, screenId }) };
}

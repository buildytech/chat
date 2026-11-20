/**
 * One agent turn of the chat (ADR 0034): what it starts from, the request, the reply message and the proposal the
 * reply carries, checked again against the page the author sees. No storage: the callers commit the messages.
 */
import { catalogDigest, diffPages, emptyPage, writePage, type DiffEntry } from "@buildytech/builder-core";
import { MODEL_CATALOG_VERSION, POLICY_VERSION, TRIAL_POLICY_VERSION, formatChatModelChoice, getChatModel, mapChatRunRequest, scopeIssues, unknownUsage, notSentUsage, aggregateSessionUsage, chatCacheKey, baseHashes, staleBlocks, type ProposalBase, type AgentMode, type RunUsage } from "@buildytech/chat-agent";
import type { PageV2 } from "@buildytech/page-contract";
import { t } from "../../../lib/i18n/dictionary";
import { fetchXaiStatus, runXaiTurn, type TurnRequest, type XaiRunResponse } from "../browser/xai-client";
import { getSelectedModelId, noteAccountModels } from "../browser/models.svelte.ts";
import { getScreenId } from "../browser/onboarding.svelte.ts";
import type { StoredPageProvenance } from "../../../lib/browser/persist";
import { getCandidatePage, getEditBase, getLastAppliedPage, getPageRevision, setCandidatePage } from "../../../lib/page-store";
import { getSelectedProject } from "../../../lib/project/store.svelte.ts";
import { draftPageId } from "../../../lib/project/transitions.ts";
import type { Project } from "../../../lib/project/types.ts";
import { getSelectedSession } from "./chat.svelte.ts";
import { blockScope } from "./block-scope.svelte.ts";
import { buildSummary } from "./build-summary";
import { conversationForTurn } from "./conversation";
import { firstReason, type RejectedIssue } from "./reason";
import type { ChatMessage, ChatProposalState, ChatRunRecord, ChatSession } from "./types";

export const nowIso = (): string => new Date().toISOString();
export const uid = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;

function blankPage(project: Pick<Project, "projectId"> | null): PageV2 {
	return emptyPage({ title: t("page.untitled"), locale: "en", id: draftPageId(project) });
}

/** The page the author sees (pending proposal, else applied page, else the last proposal kept after Discard), or null. */
function shownPageOf(): PageV2 | null {
	return getEditBase()?.page ?? null;
}

/** `source` / `appliedAtStart`: where the base came from and the applied page when the turn started (baseHash, t85u). */
type TurnPlan = { request: Omit<TurnRequest, "modelId">; base: PageV2; shown: PageV2; source: ProposalBase["source"]; appliedAtStart: PageV2 | null };

/**
 * What a turn starts from (ADR 0034). The agent edits the page the author sees. A chat with no page starts from an empty
 * page.
 */
function planTurn(brief: string, mode: AgentMode, currentMessageId?: string): TurnPlan {
	const session = getSelectedSession();
	const shownBase = shownPageOf();
	const empty = blankPage(getSelectedProject());
	const base = shownBase ?? empty;
	const shown: PageV2 = shownBase ?? empty;
	const scope = shownBase ? blockScope.ids(session?.id) : [];
	return {
		base,
		shown,
		source: shownBase ? (getEditBase()?.source === "candidate" ? "candidate" : "applied") : "empty",
		appliedAtStart: getLastAppliedPage(),
		request: {
			brief,
			mode,
			screenId: getScreenId(),
			expectedRevision: getPageRevision() ?? 0,
			currentPage: base,
			shownPage: base === shown ? null : shown,
			scopeBlockIds: scope,
			...(mode === "build" && scope.length === 1 && blockScope.fieldId(session?.id) === scope[0] ? { scenario: { id: "page.edit-fields", version: 2 } } : {}),
			conversation: conversationForTurn(session?.messages ?? [], currentMessageId),
			...(session ? { cacheKey: chatCacheKey(session.id) } : {})
		}
	};
}

export function sessionUsageFrom(session: ChatSession, extra?: RunUsage) {
	const runs = session.messages.map((m) => m.run?.usage).filter((u): u is RunUsage => Boolean(u));
	if (extra) runs.push(extra);
	return aggregateSessionUsage(runs);
}

function runRecord(opts: {
	modelId: string;
	live: boolean;
	usage: RunUsage;
	catalogDigest?: string;
	path?: string;
	tools?: string[];
	runId?: string;
	rejected?: ChatRunRecord["rejected"];
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
		catalogDigest: opts.catalogDigest ?? catalogDigest(),
		path: opts.path,
		tools: opts.tools,
		runId: opts.runId,
		usage: opts.usage,
		...(opts.rejected ? { rejected: opts.rejected } : {})
	};
}

type TurnOutcome = {
	runTrace?: import("@buildytech/chat-agent").RunTrace;
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

export async function runTurn(brief: string, mode: AgentMode, signal: AbortSignal, selection?: { modelId: string; userMessageId?: string }): Promise<TurnOutcome> {
	const plan = planTurn(brief, mode, selection?.userMessageId);
	const requestedModelId = selection?.modelId ?? getSelectedModelId();
	const status = await fetchXaiStatus(signal);
	noteAccountModels(status);
	const mapped = mapChatRunRequest(
		{ modelId: requestedModelId },
		{ discoveredChatIds: status.models?.listed ? status.models.chatIds ?? [] : undefined, allowUnlistedTrial: !status.ready }
	);
	if (!mapped.ok) {
		return { result: { ok: false, code: mapped.code, message: mapped.message }, plan, status, modelId: mapped.requestedId, live: false, usage: notSentUsage() };
	}
	if (!status.ready) {
		return {
			result: { ok: false, code: status.code || "xai_runtime_not_ready", message: runtimeNoteFor(status) },
			plan,
			status,
			modelId: mapped.request.modelId,
			live: false,
			usage: notSentUsage()
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
		runTrace: live.runTrace,
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
export function localizedRunError(code: string | undefined, message: string, modelId: string, issues?: readonly RejectedIssue[]): string {
	const label = getChatModel(modelId)?.label ?? modelId;
	if (code === "runtime_timeout") return t("runtime.timeout").replace("{code}", code);
	if (code === "runtime_platform_error") return t("runtime.platformError").replace("{code}", code);
	if (code === "model_tools_unavailable" || code === "multi_agent_tools_unavailable") {
		return t("runtime.modelToolsUnavailable").replace("{label}", label);
	}
	if (code === "client_outdated") return t("runtime.clientOutdated");
	if (code === "model_too_slow") return t("runtime.modelTooSlow").replace("{label}", label);
	if (code === "model_not_enabled_on_account") return t("runtime.modelNotOnKey").replace("{label}", label).replace("{id}", modelId);
	if (code === "tools_unsupported") return t("runtime.toolsUnsupported");
	if (code === "xai_runtime_unreachable") return t("runtime.unreachable");
	if (code === "aborted") return t("runtime.cancelled");
	// A turn that ends without an accepted write: the status and a short reason, never the model-facing error text.
	if (code === "write_invalid") return t("run.writeInvalid").replace("{code}", code).replace("{reason}", firstReason(issues, t)).replace(/\s{2,}/g, " ");
	if (code === "write_stuck") return t("run.writeStuck").replace("{code}", code).replace("{reason}", firstReason(issues, t)).replace(/\s{2,}/g, " ");
	if (code === "fields_external_error") return t("run.fieldsExternal");
	if (code?.startsWith("fields_")) return t("run.fieldsFailed");
	if (code === "build_no_proposal") return t("run.buildNoProposal");
	if (code === "no_answer") return t("run.noAnswer").replace("{code}", code);
	return message;
}

function provenanceFor(screenId: string | null): StoredPageProvenance {
	return { screenId, scenarioId: null, missing: [] };
}

/**
 * The proposal of a reply, checked again here against the page the author sees (never trusted as sent): the same write
 * gate (`writePage`, props gate loaded), the same selection scope, and the diff recomputed from the two documents.
 */
function checkedProposal(plan: TurnPlan, raw: { page: unknown }): { ok: true; page: PageV2; diff: DiffEntry[]; warnings: string[] } | { ok: false; code: string; message: string } {
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

function newProposalState(input: {
	page: PageV2;
	diff: DiffEntry[];
	warnings: string[];
	baseRevision: number;
	live: boolean;
}): ChatProposalState {
	return {
		applied: false,
		status: "pending",
		source: "write_page",
		liveModel: input.live,
		warnings: input.warnings,
		missing: [],
		title: input.page.title,
		locale: input.page.locale,
		baseRevision: input.baseRevision,
		diff: input.diff
	};
}

/**
 * The assistant message of a finished turn: the text, and in Build the diff card of the proposal, shown in Preview as the
 * pending candidate (Apply / Discard). Ask only answers.
 */
export function replyMessage(out: TurnOutcome): ChatMessage {
	const { result, plan, modelId, live, usage } = out;
	const run = runRecord({ modelId, live, usage, path: out.path, tools: out.tools, runId: out.runId, rejected: "rejected" in result ? result.rejected : undefined });
	if (!result.ok) {
		return { id: uid("msg"), role: "assistant", text: localizedRunError(result.code, result.message, modelId, "issues" in result ? result.issues : undefined), createdAt: nowIso(), run };
	}
	const mode: AgentMode = result.mode;
	const base = { id: uid("msg"), role: "assistant" as const, text: result.text, createdAt: nowIso(), mode, answer: { blocks: [...result.blocks] }, run };
	// Ask is read-only (ADR 0059): it has no write tool, and a proposal it would carry anyway is never shown or kept.
	if (!result.proposal || mode === "ask") return base;
	const checked = checkedProposal(plan, result.proposal);
	if (!checked.ok) {
		return { ...base, text: `${result.text}\n\n${t("proposal.rejected").replace("{code}", checked.code).replace("{message}", checked.message)}`.trim() };
	}
	if (!checked.diff.length) return base;
	const screenId = plan.request.screenId ?? null;
	const baseRevision = plan.request.expectedRevision;
	// baseHash: the blocks the proposal touches must still be what the turn read; a hand edit during the run is never overwritten.
	const hashes = baseHashes(plan.base, checked.diff);
	if (plan.source !== "empty") {
		const stale = staleBlocks(plan.source === "candidate" ? getCandidatePage() : getLastAppliedPage(), hashes);
		if (stale.length) return { ...base, text: [result.text.trim(), t("proposal.staleOnReply").replace("{blocks}", stale.join(", "))].filter(Boolean).join("\n\n") };
	}
	setCandidatePage(checked.page, provenanceFor(screenId));
	// The host's summary line (no model call): what was written, the blocks, the gate errors fixed, edit-fields.
	const summary = buildSummary({ page: checked.page, diff: checked.diff, trace: out.runTrace, warnings: checked.warnings });
	const message: ChatMessage = { ...base, text: [result.text.trim(), summary].filter(Boolean).join("\n\n"), proposal: newProposalState({ ...checked, baseRevision, live }) };
	proposalBaseOf.set(message, { format: "proposal-base/1", source: plan.source, baseRevision, base: hashes, applied: baseHashes(plan.appliedAtStart, checked.diff) });
	return message;
}

/** The baseHash record of a reply that installed a proposal (finishedSession files it under the message id). */
const proposalBaseOf = new WeakMap<ChatMessage, ProposalBase>();
export const proposalBaseFor = (message: ChatMessage): ProposalBase | undefined => proposalBaseOf.get(message);

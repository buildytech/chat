import { conversationForTurn } from "./conversation";
import { blockScope } from "./block-scope.svelte";
import {
	readSessionQuery,
	resolveSessionSelection,
	syncSessionQuery
} from "../api/session-url";
import { t } from "../i18n/dictionary";
import {
	COST_UNAVAILABLE,
	MODEL_CATALOG_VERSION,
	POLICY_VERSION,
	TRIAL_POLICY_VERSION,
	aggregateSessionUsage,
	catalogProvenance,
	formatChatModelChoice,
	isScenarioId,
	recordedScreenId,
	screenIdFromPage,
	getChatModel,
	mapChatRunRequest,
	runConstructorTools,
	unknownUsage,
	clientProposalGate,
	collectionBounds,
	agentToolNames,
	isAgentTextReply,
	checkPagePlan,
 pagePlanRepairs,
 repairPagePlan,
	describePageChanges,
	executePagePlan,
	manualEditsSince,
	stockScreenDraft,
	emptyPageStart,
	getScreenById,
	type AgentMode,
	type AgentTextReply,
	type ProposalContext,
	type RunUsage
} from "@buildytech/builder-core";
import { fetchXaiStatus, runXaiProposal, type XaiRunResponse } from "../browser/xai-client";

/**
 * The props gate (Ajv 2020 over the pinned registry props schemas) is its own chunk: loaded once, before the first
 * proposal is assembled or gated. Until it is installed the gate is fail-closed (props_gate_unavailable).
 */
let propsGate: Promise<unknown> | null = null;
export function loadPropsGate(): Promise<unknown> {
	propsGate ??= import("@buildytech/builder-core/props-gate").catch((err) => {
		propsGate = null;
		throw err;
	});
	return propsGate;
}
// Fetch the chunk while the author types; the first send awaits the same promise.
if (typeof window !== "undefined") setTimeout(() => void loadPropsGate().catch(() => {}), 0);
import { getSelectedModelId } from "../browser/models.svelte";
import {
	getScenarioId,
	getScreenId,
	hydrateSessionContext
} from "../browser/onboarding.svelte";
import {
	allowPersistOverwrite,
	clearPagesBlob,
	deleteSessionPages,
	getPersistError,
	loadPagesBlob,
	loadSessionsJson,
	quarantineValue,
	readSessionPages,
	saveSessionsJson,
	writeAllSessionPages,
	type StoredPageRecord
} from "../browser/persist";
import { SESSIONS_KEY as SESSIONS_STORE_KEY } from "../browser/persist";
import {
	buildSessionFile,
	parseSessionFile,
	reconcileChatRevision,
	recordRevision,
	splitSessionFile,
	type ParsedSessionFile,
	type SessionApp,
	type SessionFile,
	type SessionPins,
	type SessionSettings
} from "../browser/session-file";
import {
	applyCandidate,
	bindPageSession,
	clearCurrentPage,
	discardCandidate,
	getAppliedProvenance,
	getEditBase,
	getLastAppliedPage,
	getPageRevision,
	onPageRevision,
	setCandidatePage,
	startEmptyPage
} from "../page-store";
import { markPendingProposals, migrateSessionProposals } from "./proposals";
import { STORAGE_KEYS, readKey, writeKey } from "../browser/storage-v1.ts";
import { chatModeOf, variantProposal } from "./modes";
import { changeReportText, planResultText } from "./change-text";
import type { Page } from "@buildytech/page-contract";
import { chatCollectionFrom, collectionErrorText, collectionRequest, collectionScreenId, withoutItem, type ChatCollection } from "./collection";
import { decodeCollectionParam, parseCollection, type CollectionParse } from "@buildytech/page-contract/collection";
import type {
	ChatMessage,
	ChatSession,
	CreatorRuntimeStatus,
	ServerCapabilities,
	SessionSummary
} from "./types";

const SELECTED_KEY = STORAGE_KEYS.selectedSessionId;

function nowIso(): string {
	return new Date().toISOString();
}

function uid(prefix: string): string {
	return `${prefix}-${crypto.randomUUID()}`;
}

/** Chats from storage (schema-checked, see persist.ts), with session.pageRevision equal to the page store's revision. */
function loadMock(): ChatSession[] {
	const parsed = loadSessionsJson();
	if (!Array.isArray(parsed)) return [];
	const pages = loadPagesBlob().pages;
	let drift = false;
	const sessions = (parsed as ChatSession[]).map((raw) => {
		const session = migrateSessionProposals(raw);
		const synced = reconcileChatRevision(session, pages[session.id] ?? undefined);
		if (synced !== session) drift = true;
		return synced;
	});
	if (drift) saveSessionsJson(sessions);
	return sessions;
}

function saveMock(sessions: ChatSession[]): void {
	saveSessionsJson(sessions);
}

function restoreSessionWorkspace(session: ChatSession | null): void {
	hydrateSessionContext({
		scenarioId: session?.scenarioId ?? null,
		screenId: session?.screenId ?? null
	});
	bindPageSession(session?.id ?? null);
}

function readSelectedId(): string | null {
	return readKey(SELECTED_KEY);
}

function writeSelectedId(id: string | null): void {
	writeKey(SELECTED_KEY, id);
}

let memory = $state<ChatSession[]>([]);

// Every new revision of an applied page (proposal applied, committed inspector edit, undo / redo) is written to its
// chat: pageRevision, pageId and one history entry. Coalesced typing reaches this once per undo step (ADR 0015).
onPageRevision((event) => {
	const session = memory.find((s) => s.id === event.sessionId);
	if (!session) return;
	replaceSession(
		recordRevision(session, {
			revision: event.revision,
			at: nowIso(),
			cause: event.cause,
			pageId: event.pageId,
			...(event.blockId ? { blockId: event.blockId } : {}),
			...(event.op ? { op: event.op } : {}),
			...(event.path ? { path: event.path } : {})
		})
	);
	saveMock(memory);
});
let selectedId = $state<string | null>(null);
let hydrated = false;
let hydrating = false;
let epoch = 0;
let inflight: AbortController | null = null;
let lastError = $state<string | null>(null);
let lastRequestId = $state<string | null>(null);
let lastFailedText = $state<string | null>(null);
let capabilities = $state<ServerCapabilities | null>(null);
let connectionMode = $state<"live" | "mock" | "booting">("booting");
let canDeleteSessions = $state(true);
/** Mode picked before the chat exists (home composer); the first send stores it on the new chat. */
let pendingMode = $state<AgentMode>("build");
let pendingSkin = $state<string | null>(null);

function bumpEpoch(): number {
	epoch += 1;
	return epoch;
}

function abortInflight(): void {
	inflight?.abort();
	inflight = null;
}

function rememberSelection(id: string | null): void {
	selectedId = id;
	writeSelectedId(id);
}

function replaceSession(session: ChatSession): void {
	const rest = memory.filter((s) => s.id !== session.id);
	memory = [session, ...rest].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Load sessions from localStorage mock. Safe for onMount — not for $derived. */
export async function hydrateSessions(): Promise<void> {
	if (hydrated || hydrating) return;
	hydrating = true;
	bumpEpoch();
	try {
		connectionMode = "mock";
		// Live Grok is probed on Send (runConstructor), not while the SPA boots.
		capabilities = {
			runtime: "xai-grok",
			mode: "localStorage",
			liveModel: false,
			tools: [],
			note: "runtime.liveOnSend"
		};
		const initial = loadMock();
		memory = initial;
		const pick = resolveSessionSelection({
			urlSession: readSessionQuery(),
			persistedId: readSelectedId(),
			sessionIds: initial.map((s) => s.id)
		});
		if (pick.kind === "missing") {
			rememberSelection(null);
			restoreSessionWorkspace(null);
			lastError = t("runtime.sessionNotFound").replace("{id}", pick.requested);
			syncSessionQuery(pick.requested, { mode: "replace" });
			hydrated = true;
			return;
		}
		const id = pick.kind === "ok" ? pick.id : null;
		rememberSelection(id);
		syncSessionQuery(id, { mode: "replace" });
		restoreSessionWorkspace(id ? memory.find((s) => s.id === id) ?? null : null);
		hydrated = true;
	} finally {
		hydrating = false;
	}
}

export function listSessions(): SessionSummary[] {
	return memory
		.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSelectedSession(): ChatSession | null {
	return memory.find((s) => s.id === selectedId) ?? null;
}

/** Ask or Build for the selected chat (composer toggle, kept per chat). */
export function getChatMode(): AgentMode {
	return chatModeOf(getSelectedSession(), pendingMode);
}

export function setChatMode(mode: AgentMode): void {
	pendingMode = mode;
	const session = getSelectedSession();
	if (!session || session.mode === mode) return;
	replaceSession({ ...session, mode });
	saveMock(memory);
}

/** Skin of the selected chat's page (session `skin`): a skin id of the pinned registry, or null for the default theme. */
export function getChatSkin(): string | null {
	const session = getSelectedSession();
	return session ? (session.skin ?? null) : pendingSkin;
}

export function setChatSkin(skin: string | null): void {
	pendingSkin = skin;
	const session = getSelectedSession();
	if (!session || (session.skin ?? null) === skin) return;
	const next: ChatSession = { ...session };
	if (skin) next.skin = skin;
	else delete next.skin;
	replaceSession(next);
	saveMock(memory);
}

export function getRuntimeStatus(): CreatorRuntimeStatus {
	const persist = getPersistError();
	return {
		mode: connectionMode,
		capabilities,
		error: persist?.message ?? lastError,
		canDelete: canDeleteSessions,
		lastRequestId
	};
}

export async function selectSession(
	id: string,
	opts?: { history?: "push" | "replace" | "none" }
): Promise<void> {
	abortInflight();
	const token = bumpEpoch();
	const historyMode = opts?.history ?? "push";
	rememberSelection(id);
	if (historyMode !== "none") {
		syncSessionQuery(id, { mode: historyMode });
	}
	void token;
	const full = loadMock().find((s) => s.id === id) ?? memory.find((s) => s.id === id);
	if (full) {
		replaceSession(full);
		restoreSessionWorkspace(full);
		lastError = null;
	} else {
		memory = memory.filter((s) => s.id !== id);
		rememberSelection(null);
		restoreSessionWorkspace(null);
		lastError = t("runtime.sessionNotFound").replace("{id}", id);
	}
}

/** Chats created in this tab (not restored from storage): the left panel keeps its tab for a chat made in place. */
const createdHere = new Set<string>();
export function createdInThisTab(id: string | null | undefined): boolean {
	return Boolean(id && createdHere.has(id));
}

export async function createSession(): Promise<ChatSession> {
	abortInflight();
	const session: ChatSession = {
		id: uid("session"),
		title: t("thread.untitled"),
		updatedAt: nowIso(),
		messages: [],
		mode: pendingMode,
		...(pendingSkin ? { skin: pendingSkin } : {})
	};
	createdHere.add(session.id);
	memory = [session, ...memory];
	rememberSelection(session.id);
	syncSessionQuery(session.id, { mode: "push" });
	saveMock(memory);
	hydrateSessionContext({ scenarioId: null, screenId: null });
	bindPageSession(session.id);
	clearCurrentPage();
	return session;
}


/** The selected chat's Stock collection (session 1.3.0), or null. */
export function getChatCollection(): ChatCollection | null {
	return getSelectedSession()?.collection ?? null;
}

/** Remove one collection item (a chip) from the selected chat; the next Build turn goes without it. */
export function removeCollectionItem(index: number): void {
	const session = getSelectedSession();
	if (!session?.collection) return;
	replaceSession({ ...session, collection: withoutItem(session.collection, index) });
	saveMock(memory);
}

export type CollectionIntake = { ok: true; sessionId: string; items: number; missing: number } | { ok: false; code: string; message: string };

/**
 * Open a checked collection in a new Build chat (contract docs/collection-intake.md section 3): titled with the
 * collection, its skin, its first Stock screen, the present items as chips and the missing ones in the note.
 */
async function openCollection(parsed: CollectionParse): Promise<CollectionIntake> {
	if (!parsed.ok) {
		const message = collectionErrorText(parsed.code, parsed.issues[0]?.path);
		lastError = message;
		return { ok: false, code: parsed.code, message };
	}
	const collection = chatCollectionFrom(parsed.doc, nowIso());
	pendingMode = "build";
	pendingSkin = parsed.doc.skin ?? null;
	const created = await createSession();
	const screenId = collectionScreenId(collection);
	const session: ChatSession = { ...created, title: collection.title.slice(0, 120), mode: "build", collection, ...(screenId ? { screenId } : {}) };
	replaceSession(session);
	saveMock(memory);
	hydrateSessionContext({ scenarioId: null, screenId });
	lastError = null;
	return { ok: true, sessionId: session.id, items: collection.items.length, missing: collection.missing?.length ?? 0 };
}

/** `?collection=<base64url>` of an Open in BuildY link (read once by the caller, then removed from the URL). */
export function openCollectionParam(payload: string): Promise<CollectionIntake> {
	return openCollection(decodeCollectionParam(payload));
}

/** A `<title>.buildy-collection.json` file (Settings import, `buildy.import(json)`): same checks as the link. */
export function openCollectionFile(json: unknown): Promise<CollectionIntake> {
	return openCollection(parseCollection(json));
}

/** Apply the current URL ?session= (popstate / shared deep-link). */
export async function applySessionFromUrl(): Promise<void> {
	const urlSession = readSessionQuery();
	if (!urlSession) {
		// Bare URL without session: keep current selection, rewrite query to match.
		syncSessionQuery(selectedId, { mode: "replace" });
		return;
	}
	if (urlSession === selectedId) return;
	await selectSession(urlSession, { history: "none" });
}

/** Browser-local delete. Removes the chat and its pages from this browser. */
export function deleteSession(id: string): void {
	abortInflight();
	lastError = null;
	const remaining = memory.filter((session) => session.id !== id);
	memory = remaining;
	saveMock(memory);
	deleteSessionPages(id);
	if (selectedId !== id) return;
	const next = remaining[0] ?? null;
	rememberSelection(next?.id ?? null);
	syncSessionQuery(next?.id ?? null, { mode: "replace" });
	restoreSessionWorkspace(next);
}

export function deleteAllSessions(): void {
	abortInflight();
	lastError = null;
	allowPersistOverwrite();
	for (const session of memory) deleteSessionPages(session.id);
	memory = [];
	saveMock(memory);
	clearPagesBlob();
	rememberSelection(null);
	syncSessionQuery(null, { mode: "replace" });
	restoreSessionWorkspace(null);
}

export function abortInflightRun(): void {
	abortInflight();
	lastError = t("runtime.cancelled");
}

type EditBaseSource = "candidate" | "applied" | "last-proposal" | null;

let lastEditBase: EditBaseSource = null;
let lastSessionDemo = false;
/** The page the last turn started from (null: a fresh page); the reply text is the diff against it. */
let lastBasePage: Page | null = null;

/** When the last model turn of the chat ended (its assistant message), or null. */
function lastAgentTurnAt(session: ChatSession | null | undefined): string | null {
	const messages = session?.messages ?? [];
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const message = messages[i]!;
		if (message.role === "assistant" && message.run) return message.createdAt;
	}
	return null;
}

/**
 * Sticky demo-data state for this chat: the latest proposal's demoData (set from the model's typed
 * propose_layout.demoData flag). No author text is parsed here.
 */
function sessionDemoFromProposals(): boolean {
	const session = getSelectedSession();
	const proposals = (session?.messages ?? []).filter((message) => message.proposal);
	const last = proposals[proposals.length - 1];
	return Boolean(last?.proposal?.demoData);
}

function constructorContext(
	brief: string,
	mode: AgentMode
): ProposalContext & { sessionDemoData: boolean; collectionRequest: ReturnType<typeof collectionRequest> } {
	// Follow-ups start from what the author sees: pending proposal, else applied page,
	// else the last proposal (kept after Discard). Never from scratch unless asked.
	const base = getEditBase();
	const page = base?.page ?? null;
	const provenance = base?.provenance ?? getAppliedProvenance();
	lastEditBase = base?.source ?? null;
	const screenId =
		recordedScreenId(provenance?.screenId) ?? recordedScreenId(getScreenId()) ?? screenIdFromPage(page);
	const storedScenario = provenance?.scenarioId;
	const scenarioId = isScenarioId(storedScenario) ? storedScenario : getScenarioId();
	const sessionDemoData = sessionDemoFromProposals();
	lastSessionDemo = sessionDemoData;
	lastBasePage = page;
	const session = getSelectedSession();
	// Blocks the author edited by hand since the last agent turn (ADR 0020): Build keeps them, Ask audits them.
	const manualEdits = page ? manualEditsSince(session?.history, lastAgentTurnAt(session)) : [];
	// The chat's Stock collection bounds Build turns (the runtime re-checks the items against its own snapshot).
	const request = mode === "build" ? collectionRequest(getSelectedSession()?.collection) : null;
	return {
		conversation: conversationForTurn(getSelectedSession()?.messages ?? []),
 scopeBlockIds: blockScope.ids(getSelectedSession()?.id),
 collectionRequest: request,
		collection: collectionBounds(request),
		brief,
		mode,
		authorBrief: brief,
		scenarioId,
		screenId,
		expectedRevision: getPageRevision() ?? 0,
		pageId: page?.id,
		currentPage: page ?? undefined,
		sessionDemoData,
		...(manualEdits.length ? { manualEdits } : {}),
		currentProvenance: provenance
			? {
					screenId: recordedScreenId(provenance.screenId),
					scenarioId: scenarioId,
					missing: provenance.missing
				}
			: undefined
	};
}

function localRunUsage(): RunUsage {
	return {
		status: "complete",
		steps: 0,
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0,
		reportedBy: "none",
		cost: COST_UNAVAILABLE
	};
}

function sessionUsageFrom(session: ChatSession, extra?: RunUsage) {
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
}): import("./types").ChatRunRecord {
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

async function runConstructor(brief: string, mode: AgentMode, signal: AbortSignal) {
	const ctx = constructorContext(brief, mode);
	const status = await fetchXaiStatus(signal);
	const mapped = mapChatRunRequest(
		{ ...ctx, modelId: getSelectedModelId() },
		{
			discoveredChatIds: status.models?.listed ? status.models.chatIds ?? [] : undefined,
			allowUnlistedTrial: !status.ready
		}
	);
	if (!mapped.ok) {
		return {
			result: { ok: false as const, code: mapped.code, message: mapped.message },
			via: "blocked" as const,
			status,
			modelId: mapped.requestedId,
			live: false,
			usage: unknownUsage("error", 0)
		};
	}
	if (status.ready) {
		let live = await runXaiProposal({ ...ctx, modelId: mapped.request.modelId }, signal);
		if (live.ok && 'page' in live && ctx.scopeBlockIds?.length && ctx.currentPage) {
 const page = live.page as import('@buildytech/page-contract').Page;
 const allowed = new Set(ctx.scopeBlockIds);
 const outside = ctx.currentPage.layout.blocks.filter(block => !allowed.has(block.id));
 const bad = outside.some(block => JSON.stringify(block) !== JSON.stringify(page.layout.blocks.find(next => next.id === block.id))) || page.layout.blocks.some(block => !ctx.currentPage!.layout.blocks.some(old => old.id === block.id)) || ['title','slug','locale','seo'].some(key => JSON.stringify((page as unknown as Record<string,unknown>)[key]) !== JSON.stringify((ctx.currentPage as unknown as Record<string,unknown>)[key]));
 if (bad) live = { ...live, ok: false, code: 'outside_scope', message: 'Proposal changed content outside the selected block IDs. Nothing applied.' };
 }
 const usage =
			live.usage ??
			unknownUsage(live.ok === false && (live.code === "aborted" || signal.aborted) ? "cancelled" : "error", 0);
		return {
			result: live,
			via: "xai" as const,
			status,
			modelId: mapped.request.modelId,
			live: Boolean(live.ok && ((live as XaiRunResponse).toolCallingProven || (live as XaiRunResponse).liveXai)),
			usage,
			path: (live as XaiRunResponse).path,
			tools: (live as XaiRunResponse).toolsUsed,
			runId: (live as XaiRunResponse).runId
		};
	}
	// The local assembler builds pages; it cannot answer an Ask question, so Ask needs the live runtime.
	if (import.meta.env.PROD || mode === "ask") {
		return {
			result: {
				ok: false as const,
				code: status.code || "xai_runtime_not_ready",
				message: runtimeNoteFor(status)
			},
			via: "blocked" as const,
			status,
			modelId: mapped.request.modelId,
			live: false,
			usage: unknownUsage("error", 0)
		};
	}
	return {
		result: runConstructorTools(ctx),
		via: "local" as const,
		status,
		modelId: mapped.request.modelId,
		live: false,
		usage: localRunUsage()
	};
}

function runtimeNoteFor(status: { ready?: boolean; code?: string }): string {
	if (status.ready) return t("runtime.xaiReady");
	if (status.code === "xai_api_key_missing") return t("runtime.xaiMissing");
	if (status.code === "xai_runtime_unreachable" || status.code === "xai_status_error") {
		return t("runtime.unreachable");
	}
	if (status.code) return t("runtime.notReady").replace("{code}", status.code);
	return t("runtime.unreachable");
}

/** Never show platform text (for example Vercel's "An error occurred with your deployment"). */
function localizedRunError(code: string | undefined, message: string, modelId: string): string {
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

/** A text answer: shown as the model wrote it (safe Markdown) with its block cards; no page, no proposal. */
function textMessage(result: AgentTextReply, run?: import("./types").ChatRunRecord): ChatMessage {
	// An Ask plan from the wire is checked again here against the page the author has now (never trusted as sent).
	const plan = result.mode === "ask" && result.plan ? checkedPlan(result.plan) : null;
	return {
		id: uid("msg"),
		role: "assistant",
		text: result.text,
		createdAt: nowIso(),
		mode: result.mode,
		answer: { blocks: [...result.blocks] },
		...(plan ? { plan } : {}),
		...(run ? { run } : {})
	};
}

function baseProvenance(provenance: ReturnType<typeof getAppliedProvenance> | null | undefined) {
	return provenance
		? { screenId: recordedScreenId(provenance.screenId), scenarioId: isScenarioId(provenance.scenarioId) ? provenance.scenarioId : null, missing: provenance.missing }
		: undefined;
}

function checkedPlan(raw: unknown) {
	const base = getEditBase();
	if (!base?.page) return null;
	return checkPagePlan({
		page: base.page,
		provenance: baseProvenance(base.provenance ?? getAppliedProvenance()),
		revision: getPageRevision() ?? 0,
		sessionDemoData: sessionDemoFromProposals(),
 scopeBlockIds: blockScope.ids(getSelectedSession()?.id),
		raw
	});
}

function proposalMessage(
	result: Awaited<ReturnType<typeof runConstructor>>["result"],
	modelId: string,
	live: boolean,
	usage: RunUsage,
	extra?: { path?: string; tools?: string[]; runId?: string; basePage?: Page | null }
): ChatMessage {
	const run = runRecord({ modelId, live, usage, path: extra?.path, tools: extra?.tools, runId: extra?.runId });
	if (isAgentTextReply(result)) return textMessage(result, run);
	if (!result.ok) {
		return {
			id: uid("msg"),
			role: "assistant",
			text: localizedRunError(result.code, result.message, modelId),
			createdAt: nowIso(),
			run
		};
	}
	// Program-level catalog gate (never the model): recompute refs from the bundled Stock catalog.
	const catalog = clientProposalGate(result);
	if (!catalog.ok) {
		return {
			id: uid("msg"),
			role: "assistant",
			text: t("assistant.catalogRejected").replace("{code}", catalog.code).replace("{message}", catalog.message),
			createdAt: nowIso(),
			run
		};
	}
	setCandidatePage(result.page, {
		screenId: recordedScreenId(result.provenance.screenId),
		scenarioId: result.provenance.scenarioId,
		missing: result.missing,
		assembler: result.provenance.assembler
	});
	// The reply says what this proposal changes against the page it started from, block by block (ADR 0020).
	const basePage = extra && "basePage" in extra ? (extra.basePage ?? null) : lastBasePage;
	const report = describePageChanges(basePage, result.page);
	const text = changeReportText(report, t, {
		title: result.page.title,
		fresh: !basePage,
		screen: recordedScreenId(result.provenance.screenId),
		missing: result.missing
	});
	return {
		id: uid("msg"),
		role: "assistant",
		text,
		createdAt: nowIso(),
		...(result.modelText ? { modelText: result.modelText } : {}),
		proposal: {
			applied: false,
			status: "pending",
			source: result.source,
			liveModel: live,
			assembler: result.provenance.assembler,
			warnings: result.warnings,
			missing: result.missing,
			title: result.page.title,
			screenId: recordedScreenId(result.provenance.screenId),
			locale: result.page.locale,
			demoData: Boolean(result.demoData),
			catalogRefs: catalog.refs,
			changes: basePage
				? {
						added: report.added.map((row) => row.id),
						kept: report.kept.map((row) => row.id),
						removed: report.removed.map((row) => row.id)
					}
				: undefined
		},
		run
	};
}

async function sendMessageMock(text: string): Promise<ChatSession> {
	const trimmed = text.trim();
	if (!trimmed) {
		const current = getSelectedSession();
		if (current) return current;
		return createSession();
	}
	let session = getSelectedSession();
	if (!session) {
		// A new chat starts blank. Screens and blocks are added from the Blocks tab, not picked here.
		session = await createSession();
	}
	const mode = chatModeOf(session, pendingMode);
	const userMsg: ChatMessage = {
		id: uid("msg"),
		role: "user",
		text: trimmed,
		createdAt: nowIso(),
		selectedModelId: getSelectedModelId(),
		mode
	};
	const untitled = session.title === t("thread.untitled") || session.title === "New chat";
	const nextTitle = untitled ? trimmed.slice(0, 48) : session.title;
	const pending: ChatSession = {
		...session,
		title: nextTitle,
		updatedAt: nowIso(),
		scenarioId: session.scenarioId ?? null,
		screenId: session.screenId ?? null,
		messages: [...session.messages, userMsg]
	};
	replaceSession(pending);
	saveMock(memory);
	abortInflight();
	const ac = new AbortController();
	inflight = ac;
	const token = epoch;
	try {
		await loadPropsGate();
		const { result, status, modelId, live, usage, path, tools, runId } = await runConstructor(trimmed, mode, ac.signal);
		if (token !== epoch) return getSelectedSession() ?? pending;
		capabilities = {
			runtime: status.runtime || "xai-grok",
			mode: live ? "xai-runtime" : status.ready ? status.code || "xai_runtime_ready" : "local-assembler",
			liveModel: Boolean(status.ready),
			live: { requested: true, provider: "xai", model: modelId },
			tools: agentToolNames(getChatMode()),
			note: runtimeNoteFor(status)
		};
		if (!result.ok) lastError = result.message;
		else lastError = null;
		if (mode === "ask" && !result.ok) lastError = localizedRunError(result.code, result.message, modelId);
		const reply = proposalMessage(result, modelId, live, usage, { path, tools, runId });
		// Only a new proposal supersedes pending ones; a text answer leaves the page and its proposals as they are.
		const prior = result.ok && !isAgentTextReply(result) ? markPendingProposals(pending.messages, "superseded", "all") : pending.messages;
		const done: ChatSession = {
			...pending,
			updatedAt: nowIso(),
			selectedModelId: modelId,
			messages: [...prior, reply],
			usage: sessionUsageFrom(pending, usage)
		};
		replaceSession(done);
		saveMock(memory);
		return done;
	} catch (err) {
		if ((err as Error).name === "AbortError") {
			lastError = t("runtime.cancelled");
			const cancelled = unknownUsage("cancelled", 0);
			const reply: ChatMessage = {
				id: uid("msg"),
				role: "assistant",
				text: t("runtime.cancelled"),
				createdAt: nowIso(),
				run: runRecord({ modelId: getSelectedModelId(), live: false, usage: cancelled })
			};
			const done: ChatSession = {
				...pending,
				updatedAt: nowIso(),
				messages: [...pending.messages, reply],
				usage: sessionUsageFrom(pending, cancelled)
			};
			replaceSession(done);
			saveMock(memory);
			return done;
		}
		lastError = t("runtime.sendFailed");
		throw err;
	} finally {
		if (inflight === ac) inflight = null;
	}
}

export function applyProposal(): boolean {
	if (!getSelectedSession()) return false;
	const ok = applyCandidate((getPageRevision() ?? 0) + 1);
	if (!ok) return false;
	// Re-read: applyCandidate announced the revision and the chat got its history entry.
	const session = getSelectedSession();
	if (!session) return false;
	const applied = getLastAppliedPage();
	const provenance = getAppliedProvenance();
	const storedScenario = provenance?.scenarioId;
	const scenarioId = isScenarioId(storedScenario)
		? storedScenario
		: (session.scenarioId ?? getScenarioId());
	const next: ChatSession = {
		...session,
		updatedAt: nowIso(),
		pageId: applied?.id,
		pageRevision: getPageRevision(),
		scenarioId,
		screenId: recordedScreenId(provenance?.screenId) ?? session.screenId ?? getScreenId(),
		messages: markPendingProposals(session.messages, "applied", "latest")
	};
	replaceSession(next);
	saveMock(memory);
	return true;
}

/**
 * "Start page from this screen" (Blocks feed, ADR 0024 step B): a fresh page from one Stock screen with no model
 * call. The program assembles it (stockScreenDraft: the propose_layout path of the collection intake, no copy, so the
 * blocks keep their Stock sample), the browser catalog gate checks it, and it is applied at once as the chat's next
 * revision. A chat that already has a page or messages gets a new chat, so nothing is overwritten.
 */
export async function startPageFromScreen(screenId: string): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
	const screen = getScreenById(screenId);
	if (!screen) return { ok: false, code: "unknown_screen", message: `${screenId} is not a Stock screen.` };
	await loadPropsGate();
	const draft = stockScreenDraft({ screenId: screen.screenId });
	if (!draft.ok) return { ok: false, code: draft.code, message: draft.message };
	let session = getSelectedSession();
	if (!session || session.messages.length || getEditBase()?.page) session = await createSession();
	setChatMode("build");
	hydrateSessionContext({ scenarioId: null, screenId: screen.screenId });
	const request: ChatMessage = {
		id: uid("msg"),
		role: "user",
		text: t("feed.startRequest").replace("{title}", screen.title).replace("{screen}", screen.screenId),
		createdAt: nowIso(),
		mode: "build"
	};
	const reply: ChatMessage = { ...proposalMessage(draft.proposal, getSelectedModelId(), false, localRunUsage(), { basePage: null }), mode: "build" };
	delete reply.run;
	if (!reply.proposal) {
		discardCandidate();
		return { ok: false, code: "catalog_rejected", message: reply.text };
	}
	// No `origin`: the session schema allows only the Ask origins; this proposal is an ordinary program proposal
	// (local catalog assembler, no run record), applied at once.
	const current = getSelectedSession() ?? session;
	replaceSession({
		...current,
		mode: "build",
		title: screen.title,
		updatedAt: nowIso(),
		screenId: screen.screenId,
		messages: [...current.messages, request, reply]
	});
	saveMock(memory);
	if (!applyProposal()) return { ok: false, code: "not_applied", message: "The page did not apply." };
	return { ok: true };
}

/**
 * Empty start (ADR 0024): the first "+" or drop on a chat with no page. The selected chat (a new one when none is
 * selected) switches to Build and gets an empty page on the start Stock screen (emptyPageStart), with no model call
 * and no chat message; the caller adds the section right after, so the page and the section are one undo step.
 */
export function startEmptyPageInChat(screenId: string): boolean {
	const start = emptyPageStart({ screenId, title: t("page.untitled"), locale: "en" });
	if (!start) return false;
	let session = getSelectedSession();
	if (!session) {
		void createSession();
		session = getSelectedSession();
	}
	if (!session) return false;
	if (!startEmptyPage(start.page, start.provenance)) return false;
	setChatMode("build");
	hydrateSessionContext({ scenarioId: start.provenance.scenarioId, screenId: start.provenance.screenId });
	const current = getSelectedSession() ?? session;
	replaceSession({ ...current, mode: "build", updatedAt: nowIso(), pageId: start.page.id, pageRevision: 0, scenarioId: start.provenance.scenarioId, screenId: start.provenance.screenId });
	saveMock(memory);
	return true;
}

/**
 * Apply variant from an Ask block card: the chat switches to Build and gets an ordinary set_variant proposal through
 * the same editPage and browser gate as model edits. Pending until the author presses Apply; no model call.
 */
export function applyVariantFromAsk(spec: string, variant: string): boolean {
	const session = getSelectedSession();
	if (!session) return false;
	setChatMode("build");
	const base = getEditBase();
	lastEditBase = base?.source ?? null;
	const sessionDemoData = sessionDemoFromProposals();
	lastSessionDemo = sessionDemoData;
	const provenance = base?.provenance ?? null;
	const result = variantProposal({
 scopeBlockIds: blockScope.ids(session.id),
		page: base?.page,
		provenance: provenance
			? { screenId: recordedScreenId(provenance.screenId), scenarioId: isScenarioId(provenance.scenarioId) ? provenance.scenarioId : null, missing: provenance.missing }
			: null,
		revision: getPageRevision() ?? 0,
		spec,
		variant,
		sessionDemoData
	});
	const request: ChatMessage = {
		id: uid("msg"),
		role: "user",
		text: t("ask.applyRequest").replace("{variant}", variant).replace("{block}", spec),
		createdAt: nowIso(),
		mode: "build"
	};
	let reply: ChatMessage;
	if (!result.ok && (result.code === "no_page" || result.code === "block_not_on_page" || result.code === "unknown_block")) {
		reply = { id: uid("msg"), role: "assistant", text: t(`ask.apply.${result.code}`).replace("{block}", spec), createdAt: nowIso(), mode: "build" };
	} else {
		reply = { ...proposalMessage(result, getSelectedModelId(), false, localRunUsage(), { basePage: base?.page ?? null }), mode: "build" };
		delete reply.run;
		if (reply.proposal) {
			reply.proposal = { ...reply.proposal, origin: "ask-card" };
			reply.text = `${t("ask.applyVia")}\n${reply.text}`;
		}
	}
	const current = getSelectedSession() ?? session;
	const prior = reply.proposal ? markPendingProposals(current.messages, "superseded", "all") : current.messages;
	replaceSession({ ...current, mode: "build", updatedAt: nowIso(), messages: [...prior, request, reply] });
	saveMock(memory);
	return Boolean(reply.proposal);
}

/**
 * Apply in Build on an Ask plan card (ADR 0020): the chat switches to Build and the ticked ops run on the current page
 * through the page-patch gates, in order, without a model call. Ops that no longer apply are said with their reason;
 * the others make one pending proposal the author applies. The plan keeps each op's result.
 */
/** Fix a catalog enum locally and recheck the entire sequence on the visible page. */
export function getPlanRepairs(messageId: string) {
 const base = getEditBase();
 const source = getSelectedSession()?.messages.find(message=>message.id===messageId);
 if (!base?.page || !source?.plan || source.plan.status !== 'proposed') return [];
 return pagePlanRepairs({sessionDemoData:sessionDemoFromProposals(),page:base.page, provenance:base.provenance ?? undefined, revision:getPageRevision() ?? 0, scopeBlockIds:blockScope.ids(getSelectedSession()?.id), plan:source.plan});
}
export function repairPlanField(messageId: string, opId: string, field: string, value: string): boolean {
 const session=getSelectedSession(), base=getEditBase();
 const source=session?.messages.find(message=>message.id===messageId);
 if (!session || !base?.page || !source?.plan) return false;
 const plan=repairPagePlan({sessionDemoData:sessionDemoFromProposals(),page:base.page,provenance:base.provenance ?? undefined,revision:getPageRevision() ?? 0,scopeBlockIds:blockScope.ids(session.id),plan:source.plan,opId,field,value});
 if (!plan) return false;
 replaceSession({...session,messages:session.messages.map(message=>message.id===messageId?{...message,plan}:message),updatedAt:nowIso()});
 saveMock(memory);
 return true;
}

export function applyPlanInBuild(messageId: string, selected: readonly string[]): boolean {
	const session = getSelectedSession();
	const source = session?.messages.find((message) => message.id === messageId);
	if (!session || !source?.plan || !selected.length || source.plan.status !== "proposed") return false;
	setChatMode("build");
	const request: ChatMessage = {
		id: uid("msg"),
		role: "user",
		text: t("plan.request").replace("{n}", String(selected.length)),
		createdAt: nowIso(),
		mode: "build"
	};
	const base = getEditBase();
	const current = getSelectedSession() ?? session;
	if (!base?.page) {
		const reply: ChatMessage = { id: uid("msg"), role: "assistant", text: t("plan.noPage"), createdAt: nowIso(), mode: "build" };
		replaceSession({ ...current, mode: "build", updatedAt: nowIso(), messages: [...current.messages, request, reply] });
		saveMock(memory);
		return false;
	}
	lastEditBase = base.source;
	const exec = executePagePlan({
		page: base.page,
		provenance: baseProvenance(base.provenance ?? getAppliedProvenance()),
		scopeBlockIds: blockScope.ids(session.id),
 plan: source.plan,
		selected,
		revision: getPageRevision() ?? 0,
		sessionDemoData: sessionDemoFromProposals(),
		at: nowIso()
	});
	let reply: ChatMessage;
	if (exec.proposal) {
		reply = { ...proposalMessage(exec.proposal, getSelectedModelId(), false, localRunUsage(), { basePage: base.page }), mode: "build" };
		delete reply.run;
		if (reply.proposal) reply.proposal = { ...reply.proposal, origin: "ask-plan" };
		reply.text = `${reply.text}\n${planResultText(exec.plan, t)}`;
	} else {
		reply = { id: uid("msg"), role: "assistant", text: planResultText(exec.plan, t), createdAt: nowIso(), mode: "build" };
	}
	const withPlan = current.messages.map((message) => (message.id === messageId ? { ...message, plan: exec.plan } : message));
	const prior = reply.proposal ? markPendingProposals(withPlan, "superseded", "all") : withPlan;
	replaceSession({ ...current, mode: "build", updatedAt: nowIso(), messages: [...prior, request, reply] });
	saveMock(memory);
	return Boolean(reply.proposal);
}

export function discardProposal(): void {
	discardCandidate();
	const session = getSelectedSession();
	if (!session) return;
	replaceSession({
		...session,
		updatedAt: nowIso(),
		messages: markPendingProposals(session.messages, "discarded", "latest")
	});
	saveMock(memory);
}

/** ChatCore send. Ordinary text never auto-saves a page. Live Grok uses `/runtime`. */
export async function sendMessage(text: string, _opts?: { requestId?: string; retry?: boolean }): Promise<ChatSession> {
	return sendMessageMock(text);
}

export async function retryLastFailed(): Promise<ChatSession | null> {
	if (!lastFailedText || !lastRequestId) return null;
	return sendMessage(lastFailedText, { retry: true, requestId: lastRequestId });
}

/** The session file buildy:v1 of this browser (every chat, its page record, revisions and history). Writes nothing. */
export function exportSessions(meta: { app: SessionApp; pins: SessionPins; settings?: SessionSettings; prefs?: import("../browser/session-file").SessionPrefs }): SessionFile {
	const current = getSelectedSession();
	if (current) saveMock(memory);
	const pages: Record<string, StoredPageRecord | null> = {};
	for (const session of memory) pages[session.id] = readSessionPages(session.id);
	return buildSessionFile({
		chats: memory as unknown as import("../browser/session-file").StoredChat[],
		pages,
		selectedSessionId: selectedId,
		...meta
	});
}

export type ImportResult =
	| { ok: true; added: string[]; replaced: string[]; selected: string | null }
	| (Extract<ParsedSessionFile, { ok: false }> & { added?: never })
	| { ok: false; code: "storage_refused"; issues: { path: string; keyword: string }[] };

/**
 * Load a session file: checked against session.schema.json and its program checks first (nothing is written when it
 * fails). A chat with an id that already exists here is replaced; the replaced chat and its page record are kept in
 * quarantine first, so an import never loses data.
 */
export async function importSessions(input: unknown): Promise<ImportResult> {
	const parsed = parseSessionFile(input);
	if (!parsed.ok) return parsed;
	abortInflight();
	const { chats, pages } = splitSessionFile(parsed.file);
	const incoming = new Set(chats.map((c) => c.id));
	const replaced: string[] = [];
	for (const session of memory) {
		if (!incoming.has(session.id)) continue;
		const page = readSessionPages(session.id);
		if (!quarantineValue(SESSIONS_STORE_KEY, "replaced_by_import", JSON.stringify({ ...session, page }))) {
			return { ok: false, code: "storage_refused", issues: [{ path: `$.sessions.${session.id}`, keyword: "quarantine" }] };
		}
		replaced.push(session.id);
	}
	// Unbind first: the bound chat's in-memory page is saved now, so it cannot overwrite an imported record later.
	bindPageSession(null);
	const imported = (chats as unknown as ChatSession[]).map(migrateSessionProposals);
	const kept = memory.filter((s) => !incoming.has(s.id));
	memory = [...imported, ...kept].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	saveMock(memory);
	for (const id of incoming) if (!(id in pages)) deleteSessionPages(id);
	writeAllSessionPages(pages);
	const pick = parsed.file.selectedSessionId ?? imported[0]?.id ?? null;
	if (pick) await selectSession(pick, { history: "replace" });
	return { ok: true, added: chats.map((c) => c.id).filter((id) => !replaced.includes(id)), replaced, selected: pick };
}

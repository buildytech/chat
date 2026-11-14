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
	addScreen,
	aggregateSessionUsage,
	applyOp,
	catalogProvenance,
	collectionBounds,
	collectionDraft,
	diffPages,
	emptyPage,
	formatChatModelChoice,
	getChatModel,
	getScreenById,
	itemOfSpec,
	mapChatRunRequest,
	agentToolNames,
	scopeIssues,
	unknownUsage,
	writePage,
	installRenderProbe,
	type AgentMode,
	type DiffEntry,
	type RunUsage
} from "@buildytech/builder-core";
import { fetchXaiStatus, runXaiTurn, type TurnRequest, type XaiRunResponse } from "../browser/xai-client";

/**
 * The write gates of the browser: the props gate (Ajv 2020 over the pinned registry props schemas; its own chunk) and the
 * render probe (the compiled registry blocks, ADR 0038; one file, fetched on first use). `loadPropsGate` loads both, once,
 * before the first proposal is assembled or gated. Until they are installed both are fail-closed (props_gate_unavailable,
 * render_probe_unavailable). The idle prefetch below takes only the props gate; the probe waits for the first write path.
 */
let propsChunk: Promise<unknown> | null = null;
let probeChunk: Promise<unknown> | null = null;
if (typeof window !== "undefined") installRenderProbe(null, { required: true, empty: "allow" });
function importPropsGate(): Promise<unknown> {
	propsChunk ??= import("@buildytech/builder-core/props-gate").catch((err) => {
		propsChunk = null;
		throw err;
	});
	return propsChunk;
}
function importRenderProbe(): Promise<unknown> {
	probeChunk ??= Promise.all([import("../preview/render-probe"), import("$app/paths")]).then(([probe, paths]) => probe.loadRenderProbe(`${paths.base}${probe.RENDER_BUNDLE_PATH}`)).catch((err) => {
		probeChunk = null;
		throw err;
	});
	return probeChunk;
}
export function loadPropsGate(): Promise<unknown> {
	return Promise.all([importPropsGate(), importRenderProbe()]);
}
// Fetch the chunk while the author types; the first send awaits the same promise.
if (typeof window !== "undefined") setTimeout(() => void importPropsGate().catch(() => {}), 0);
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
import { isPendingProposal, markPendingProposals, migrateSessionProposals, withProposalStatus } from "./proposals";
import { STORAGE_KEYS, readKey, writeKey } from "../browser/storage-v1.ts";
import { chatModeOf } from "./modes";
import type { PageV2 } from "@buildytech/page-contract";
import type { StoredPageProvenance } from "../browser/persist";
import { chatCollectionFrom, collectionErrorText, collectionRequest, collectionScreenId, withoutItem, type ChatCollection } from "./collection";
import { decodeCollectionParam, parseCollection, type CollectionParse } from "@buildytech/page-contract/collection";
import type {
	ChatMessage,
	ChatProposalState,
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

/** Page id of a chat that has no page yet: stable per chat (`page-<uuid>`). */
function draftPageId(session: ChatSession | null): string {
	return session ? `page-${session.id.replace(/^session-/, "")}`.slice(0, 64) : "page-draft";
}

function blankPage(session: ChatSession | null): PageV2 {
	return emptyPage({ title: t("page.untitled"), locale: "en", id: draftPageId(session) });
}

/** The page the author sees (pending proposal, else applied page, else the last proposal kept after Discard), or null. */
function shownPageOf(): PageV2 | null {
	return getEditBase()?.page ?? null;
}

type TurnPlan = { request: Omit<TurnRequest, "modelId">; base: PageV2; shown: PageV2 };

/**
 * What a turn starts from (ADR 0034). The agent edits the page the author sees. A chat with no page starts from an empty
 * page, or, in a collection chat, from the draft of the collection (its first screen and required blocks) with the
 * empty page as what the author sees, so the diff reads as additions.
 */
function planTurn(brief: string, mode: AgentMode): TurnPlan {
	const session = getSelectedSession();
	const shownBase = shownPageOf();
	const collection = mode === "build" ? collectionRequest(session?.collection) : null;
	const empty = blankPage(session);
	let base = shownBase ?? empty;
	let shown: PageV2 = shownBase ?? empty;
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

type TurnOutcome = {
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

async function runTurn(brief: string, mode: AgentMode, signal: AbortSignal): Promise<TurnOutcome> {
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

function provenanceFor(screenId: string | null): StoredPageProvenance {
	return { screenId, scenarioId: null, missing: [] };
}

const diffKey = (diff: readonly unknown[]): string => JSON.stringify(diff);

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
function replyMessage(out: TurnOutcome): ChatMessage {
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
		const out = await runTurn(trimmed, mode, ac.signal);
		if (token !== epoch) return getSelectedSession() ?? pending;
		const { result, status, modelId, live, usage } = out;
		capabilities = {
			runtime: status.runtime || "xai-grok",
			mode: live ? "xai-runtime" : status.ready ? status.code || "xai_runtime_ready" : "unavailable",
			liveModel: Boolean(status.ready),
			live: { requested: true, provider: "xai", model: modelId },
			tools: agentToolNames(mode),
			note: runtimeNoteFor(status)
		};
		lastError = result.ok ? null : localizedRunError(result.code, result.message, modelId);
		const reply = replyMessage(out);
		// A new proposal supersedes the pending ones of its own kind: an Ask proposal the Ask ones, a Build proposal the Build ones.
		const prior = reply.proposal ? markPendingProposals(pending.messages, "superseded", "all", (m) => (m.mode === "ask") === (reply.mode === "ask")) : pending.messages;
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
	const next: ChatSession = {
		...session,
		updatedAt: nowIso(),
		pageId: applied?.id,
		pageRevision: getPageRevision(),
		screenId: provenance?.screenId ?? session.screenId ?? getScreenId(),
		messages: markPendingProposals(session.messages, "applied", "latest", (m) => m.mode !== "ask")
	};
	replaceSession(next);
	saveMock(memory);
	return true;
}

type Started = { ok: true } | { ok: false; code: string; message: string };

/** One Build proposal the host made itself (no model call): the candidate, its messages, then Apply. */
function recordHostProposal(session: ChatSession, requestText: string, replyText: string, page: PageV2, diff: DiffEntry[], opts: { origin?: ChatProposalState["origin"]; screenId?: string | null; baseRevision: number; title?: string }): void {
	setCandidatePage(page, provenanceFor(opts.screenId ?? null));
	const request: ChatMessage = { id: uid("msg"), role: "user", text: requestText, createdAt: nowIso(), mode: "build" };
	const reply: ChatMessage = {
		id: uid("msg"),
		role: "assistant",
		text: replyText,
		createdAt: nowIso(),
		mode: "build",
		proposal: newProposalState({ page, diff, warnings: [], baseRevision: opts.baseRevision, live: false, screenId: opts.screenId ?? null, origin: opts.origin })
	};
	const current = getSelectedSession() ?? session;
	const prior = markPendingProposals(current.messages, "superseded", "all", (m) => m.mode !== "ask");
	replaceSession({ ...current, mode: "build", ...(opts.title ? { title: opts.title } : {}), updatedAt: nowIso(), ...(opts.screenId ? { screenId: opts.screenId } : {}), messages: [...prior, request, reply] });
	saveMock(memory);
}

/**
 * "Start page from this screen" (Blocks feed): a fresh page from one Stock screen with no model call. The screen's
 * renderable sections become the blocks of an empty page with the registry sample props (addScreen), the write gate
 * checks them and the page is applied at once as the chat's next revision. A chat that already has a page or messages
 * gets a new chat, so nothing is overwritten.
 */
export async function startPageFromScreen(screenId: string): Promise<Started> {
	const screen = getScreenById(screenId);
	if (!screen) return { ok: false, code: "unknown_screen", message: `${screenId} is not a Stock screen.` };
	await loadPropsGate();
	let session = getSelectedSession();
	if (!session || session.messages.length || getEditBase()?.page) session = await createSession();
	const started = addScreen(emptyPage({ title: screen.title, locale: "en", id: draftPageId(session) }), screen.screenId);
	if (!started.ok) return { ok: false, code: started.code, message: started.message };
	setChatMode("build");
	hydrateSessionContext({ scenarioId: null, screenId: screen.screenId });
	const empty = emptyPage({ title: screen.title, locale: "en", id: draftPageId(session) });
	recordHostProposal(
		session,
		t("feed.startRequest").replace("{title}", screen.title).replace("{screen}", screen.screenId),
		t("feed.startReply").replace("{title}", screen.title),
		started.page,
		diffPages(empty, started.page),
		{ screenId: screen.screenId, baseRevision: getPageRevision() ?? 0, title: screen.title }
	);
	if (!applyProposal()) return { ok: false, code: "not_applied", message: "The page did not apply." };
	return { ok: true };
}

/**
 * Empty start: the first "+" or drop on a chat with no page. The selected chat (a new one when none is selected)
 * switches to Build and gets an empty page (no sections), with no model call and no chat message; the caller adds the
 * section right after, so the page and the section are one undo step.
 */
export function startEmptyPageInChat(screenId: string | null = null): boolean {
	let session = getSelectedSession();
	if (!session) {
		void createSession();
		session = getSelectedSession();
	}
	if (!session) return false;
	const page = blankPage(session);
	if (!startEmptyPage(page, provenanceFor(screenId))) return false;
	setChatMode("build");
	hydrateSessionContext({ scenarioId: null, screenId });
	const current = getSelectedSession() ?? session;
	replaceSession({ ...current, mode: "build", updatedAt: nowIso(), pageId: page.id, pageRevision: 0, screenId });
	saveMock(memory);
	return true;
}

/**
 * Apply variant from an Ask block card: the chat switches to Build and gets an ordinary set_variant proposal through the
 * same write gate (applyOp -> writePage) as every other edit. Pending until the author presses Apply; no model call.
 */
export function applyVariantFromAsk(spec: string, variant: string): boolean {
	const session = getSelectedSession();
	if (!session) return false;
	setChatMode("build");
	const base = getEditBase();
	const item = itemOfSpec(spec);
	const target = base && item ? base.page.blocks.find((block) => block.item === item) : null;
	const request: ChatMessage = {
		id: uid("msg"),
		role: "user",
		text: t("ask.applyRequest").replace("{variant}", variant).replace("{block}", spec),
		createdAt: nowIso(),
		mode: "build"
	};
	const fail = (key: string): false => {
		const current = getSelectedSession() ?? session;
		const reply: ChatMessage = { id: uid("msg"), role: "assistant", text: t(key).replace("{block}", spec), createdAt: nowIso(), mode: "build" };
		replaceSession({ ...current, mode: "build", updatedAt: nowIso(), messages: [...current.messages, request, reply] });
		saveMock(memory);
		return false;
	};
	if (!base) return fail("ask.apply.no_page");
	if (!item) return fail("ask.apply.unknown_block");
	if (!target) return fail("ask.apply.block_not_on_page");
	const op = applyOp(base.page, { op: "set_variant", blockId: target.id, variant });
	if (!op.ok) return fail("ask.apply.rejected");
	recordHostProposal(session, request.text, t("ask.applyVia"), op.page, diffPages(base.page, op.page), { origin: "ask-card", screenId: base.provenance?.screenId ?? null, baseRevision: getPageRevision() ?? 0 });
	return true;
}

export type AskApplyResult = { ok: true } | { ok: false; code: "outdated" | "not_found" | "rejected"; message: string };

/**
 * "Apply in Build" on the proposal of an Ask answer: the one way an Ask reaches the page. The stored page document goes
 * through the same write gate against the page the author sees now, and applies only when the diff it makes is still the
 * diff the author was shown (the page did not move on). Then the chat is in Build and the page is the next revision:
 * one step, the registry sample props the proposal carries.
 */
export async function applyAskProposal(messageId: string): Promise<AskApplyResult> {
	const session = getSelectedSession();
	const source = session?.messages.find((message) => message.id === messageId);
	const proposal = source?.proposal;
	if (!session || !proposal?.page || proposal.origin !== "ask-proposal" || !isPendingProposal(proposal)) {
		return { ok: false, code: "not_found", message: t("proposal.askNotFound") };
	}
	try {
		await loadPropsGate();
	} catch {
		return { ok: false, code: "rejected", message: t("inspector.loadFailed") };
	}
	const shown = shownPageOf();
	const base = shown ?? blankPage(session);
	const written = writePage(base, { page: proposal.page });
	const stale = (proposal.baseRevision ?? 0) !== (getPageRevision() ?? 0);
	if (!written.ok) return { ok: false, code: "rejected", message: t("proposal.rejected").replace("{code}", written.issues[0]?.code ?? written.code).replace("{message}", `${written.issues[0]?.path ?? "/"}`) };
	const diff = diffPages(base, written.page);
	if (stale || diffKey(diff) !== diffKey(proposal.diff ?? [])) return { ok: false, code: "outdated", message: t("proposal.askOutdated") };
	setChatMode("build");
	const replyText = t("ask.appliedInBuild");
	const request: ChatMessage = { id: uid("msg"), role: "user", text: t("ask.applyProposalRequest"), createdAt: nowIso(), mode: "build" };
	setCandidatePage(written.page, provenanceFor(proposal.screenId ?? null));
	const reply: ChatMessage = {
		id: uid("msg"),
		role: "assistant",
		text: replyText,
		createdAt: nowIso(),
		mode: "build",
		proposal: newProposalState({ page: written.page, diff, warnings: written.warnings, baseRevision: getPageRevision() ?? 0, live: false, screenId: proposal.screenId ?? null, origin: "ask-proposal" })
	};
	const current = getSelectedSession() ?? session;
	const messages = current.messages.map((message) => (message.id === messageId ? { ...message, proposal: withProposalStatus(message.proposal!, "applied") } : message));
	const prior = markPendingProposals(messages, "superseded", "all", (m) => m.mode !== "ask");
	replaceSession({ ...current, mode: "build", updatedAt: nowIso(), messages: [...prior, request, reply] });
	saveMock(memory);
	return applyProposal() ? { ok: true } : { ok: false, code: "rejected", message: t("proposal.rejected").replace("{code}", "not_applied").replace("{message}", "") };
}

export function discardProposal(): void {
	discardCandidate();
	const session = getSelectedSession();
	if (!session) return;
	replaceSession({
		...session,
		updatedAt: nowIso(),
		messages: markPendingProposals(session.messages, "discarded", "latest", (m) => m.mode !== "ask")
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

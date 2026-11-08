import {
	createSessionApi,
	getCapabilitiesApi,
	getSessionApi,
	GatewayRequestError,
	listMessagesApi,
	listSessionsApi,
	newRequestId,
	postMessageApi,
	recoverRunApi,
	type ServerCapabilities
} from "../api/gateway";
import { mapSession, pageFromTurn, parseServerPage } from "../api/map";
import { isMockMode } from "../api/mode";
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
	getChatModel,
	mapChatRunRequest,
	runConstructorTools,
	unknownUsage,
	type ProposalContext,
	type RunUsage
} from "@buildytech/builder-core";
import { fetchXaiStatus, runXaiProposal, type XaiRunResponse } from "../browser/xai-client";
import { getSelectedModelId } from "../browser/models.svelte";
import {
	getScenarioId,
	getScreenId,
	hydrateSessionContext,
	setOnboardingPersist
} from "../browser/onboarding.svelte";
import {
	getPersistError,
	loadSessionsJson,
	saveSessionsJson
} from "../browser/persist";
import {
	applyCandidate,
	bindPageSession,
	clearCurrentPage,
	discardCandidate,
	getLastAppliedPage,
	getPageRevision,
	setCandidatePage,
	setCurrentPage
} from "../page-store";
import type { ChatMessage, ChatSession, CreatorRuntimeStatus, SessionSummary } from "./types";

const SELECTED_KEY = "buildy.creator.selectedSessionId";

function nowIso(): string {
	return new Date().toISOString();
}

function uid(prefix: string): string {
	return `${prefix}-${crypto.randomUUID()}`;
}

function loadMock(): ChatSession[] {
	const parsed = loadSessionsJson();
	return Array.isArray(parsed) ? (parsed as ChatSession[]) : [];
}

function saveMock(sessions: ChatSession[]): void {
	saveSessionsJson(sessions);
}

function persistSessionContext(): void {
	const session = getSelectedSession();
	if (!session) return;
	replaceSession({
		...session,
		scenarioId: getScenarioId(),
		screenId: getScreenId()
	});
	saveMock(memory);
}

function restoreSessionWorkspace(session: ChatSession | null): void {
	hydrateSessionContext({
		scenarioId: session?.scenarioId ?? null,
		screenId: session?.screenId ?? null
	});
	bindPageSession(session?.id ?? null);
}

function readSelectedId(): string | null {
	if (typeof localStorage === "undefined") return null;
	try {
		return localStorage.getItem(SELECTED_KEY);
	} catch {
		return null;
	}
}

function writeSelectedId(id: string | null): void {
	if (typeof localStorage === "undefined") return;
	try {
		if (id) localStorage.setItem(SELECTED_KEY, id);
		else localStorage.removeItem(SELECTED_KEY);
	} catch {
		/* ignore */
	}
}

let memory = $state<ChatSession[]>([]);
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
let canDeleteSessions = $state(false); // Session HTTP has no DELETE in M4

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

function applyPageFromServer(pageRaw: unknown, revision: number | null, token: number): boolean {
	if (token !== epoch) return false;
	if (pageRaw == null) {
		clearCurrentPage();
		return true;
	}
	const page = parseServerPage(pageRaw);
	if (!page) {
		// Malformed DTO must not overwrite Workspace.
		lastError = t("runtime.badPage");
		return false;
	}
	setCurrentPage(page, revision);
	return true;
}

async function loadSessionDetail(id: string, token: number): Promise<void> {
	const ac = new AbortController();
	inflight = ac;
	try {
		const [sessRes, msgRes] = await Promise.all([
			getSessionApi(id, ac.signal),
			listMessagesApi(id, ac.signal)
		]);
		if (token !== epoch) return;
		const session = mapSession(sessRes.session, msgRes.messages);
		replaceSession(session);
		rememberSelection(session.id);
		if (sessRes.page?.page) {
			applyPageFromServer(sessRes.page.page, sessRes.page.revision ?? sessRes.session.pageRevision, token);
		} else {
			clearCurrentPage();
		}
		lastError = null;
	} catch (err) {
		if ((err as Error).name === "AbortError") return;
		if (token !== epoch) return;
		if (err instanceof GatewayRequestError && (err.status === 404 || err.code === "not_found")) {
			memory = memory.filter((s) => s.id !== id);
			rememberSelection(null);
			clearCurrentPage();
			lastError = t("runtime.sessionNotFound").replace("{id}", id);
			return;
		}
		lastError = err instanceof GatewayRequestError ? err.message : t("runtime.loadFailed");
	} finally {
		if (inflight === ac) inflight = null;
	}
}

/** Load sessions from mock (default) or Session HTTP (`?live=1`). Safe for onMount — not for $derived. */
export async function hydrateSessions(): Promise<void> {
	if (hydrated || hydrating) return;
	hydrating = true;
	const token = bumpEpoch();
	try {
		if (isMockMode()) {
			connectionMode = "mock";
			capabilities = {
				runtime: "mock",
				mode: "localStorage",
				liveModel: false,
				tools: [],
				note: t("runtime.mockMode")
			};
			const initial = loadMock();
			memory = initial;
			const pick = resolveSessionSelection({
				urlSession: readSessionQuery(),
				persistedId: readSelectedId(),
				sessionIds: initial.map((s) => s.id)
			});
			setOnboardingPersist(() => persistSessionContext());
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
			return;
		}

		connectionMode = "live";
		try {
			capabilities = await getCapabilitiesApi();
		} catch {
			capabilities = {
				runtime: "context-local",
				mode: "unreachable",
				liveModel: false,
				tools: [],
				note: t("runtime.capabilitiesFailed")
			};
		}

		const listed = await listSessionsApi();
		let sessions = listed.sessions ?? [];
		if (sessions.length === 0) {
			const created = await createSessionApi({});
			sessions = [created.session];
		}
		memory = sessions.map((s) => mapSession(s, []));
		const pick = resolveSessionSelection({
			urlSession: readSessionQuery(),
			persistedId: readSelectedId(),
			sessionIds: sessions.map((s) => s.id)
		});
		hydrated = true;
		if (pick.kind === "missing") {
			// Do not fall back to persisted/first — keep URL, try server, else blank+error.
			rememberSelection(null);
			clearCurrentPage();
			syncSessionQuery(pick.requested, { mode: "replace" });
			await loadSessionDetail(pick.requested, token);
			if (selectedId) {
				syncSessionQuery(selectedId, { mode: "replace" });
			} else if (!lastError) {
				lastError = t("runtime.sessionNotFound").replace("{id}", pick.requested);
			}
			return;
		}
		const id = pick.kind === "ok" ? pick.id : null;
		rememberSelection(id);
		syncSessionQuery(id, { mode: "replace" });
		if (id) await loadSessionDetail(id, token);
		else clearCurrentPage();
	} catch (err) {
		lastError = err instanceof GatewayRequestError ? err.message : t("runtime.hydrateFailed");
		// Never silently fall back to mock on API failure.
		memory = [];
		rememberSelection(null);
		clearCurrentPage();
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
	if (isMockMode()) {
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
		return;
	}
	clearCurrentPage();
	const existing = memory.find((s) => s.id === id);
	if (existing) {
		replaceSession({ ...existing, messages: [] });
	}
	await loadSessionDetail(id, token);
}

export async function createSession(): Promise<ChatSession> {
	abortInflight();
	const token = bumpEpoch();
	if (isMockMode()) {
		const session: ChatSession = {
			id: uid("session"),
			title: t("thread.untitled"),
			updatedAt: nowIso(),
			messages: []
		};
		memory = [session, ...memory];
		rememberSelection(session.id);
		syncSessionQuery(session.id, { mode: "push" });
		saveMock(memory);
		hydrateSessionContext({ scenarioId: null, screenId: null });
		bindPageSession(session.id);
		clearCurrentPage();
		return session;
	}
	const { session: raw } = await createSessionApi({});
	const session = mapSession(raw, []);
	replaceSession(session);
	rememberSelection(session.id);
	syncSessionQuery(session.id, { mode: "push" });
	clearCurrentPage();
	void token;
	lastError = null;
	return session;
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

/** M4: Session HTTP has no DELETE — UI must stay disabled/truthful. */
export function deleteSession(_id: string): void {
	lastError = t("runtime.deleteUnavailable");
}

export function abortInflightRun(): void {
	abortInflight();
	lastError = t("runtime.cancelled");
}

function constructorContext(brief: string): ProposalContext {
	const applied = getLastAppliedPage();
	return {
		brief,
		scenarioId: getScenarioId(),
		screenId: getScreenId(),
		expectedRevision: getPageRevision() ?? 0,
		pageId: applied?.id,
		currentPage: applied ?? undefined
	};
}

function localRunUsage(): RunUsage {
	return {
		status: "complete",
		steps: 0,
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0,
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
		usage: opts.usage
	};
}

async function runConstructor(brief: string, signal: AbortSignal) {
	const ctx = constructorContext(brief);
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
		const live = await runXaiProposal({ ...ctx, modelId: mapped.request.modelId }, signal);
		const usage =
			live.usage ??
			unknownUsage(live.ok === false && (live.code === "aborted" || signal.aborted) ? "cancelled" : "error", 0);
		return {
			result: live,
			via: "xai" as const,
			status,
			modelId: mapped.request.modelId,
			live: Boolean(live.ok && (live as XaiRunResponse).toolCallingProven),
			usage
		};
	}
	if (import.meta.env.PROD) {
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

function proposalMessage(
	result: Awaited<ReturnType<typeof runConstructor>>["result"],
	modelId: string,
	live: boolean,
	usage: RunUsage
): ChatMessage {
	const run = runRecord({ modelId, live, usage });
	if (!result.ok) {
		return {
			id: uid("msg"),
			role: "assistant",
			text: result.message,
			createdAt: nowIso(),
			run
		};
	}
	setCandidatePage(result.page);
	const via =
		result.source === "local-catalog-assembler" ? t("assistant.localAssembler") : t("assistant.xaiProposal");
	const missing = result.missing.length
		? ` ${t("assistant.missingBlocks").replace("{list}", result.missing.join(", "))}`
		: "";
	return {
		id: uid("msg"),
		role: "assistant",
		text: `${via} ${t("assistant.proposalReady").replace("{title}", result.page.title)}${missing}`,
		createdAt: nowIso(),
		proposal: {
			applied: false,
			source: result.source,
			liveModel: false,
			warnings: result.warnings,
			missing: result.missing,
			title: result.page.title
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
	if (!session) session = await createSession();
	const userMsg: ChatMessage = {
		id: uid("msg"),
		role: "user",
		text: trimmed,
		createdAt: nowIso(),
		selectedModelId: getSelectedModelId()
	};
	const untitled = session.title === t("thread.untitled") || session.title === "New chat";
	const nextTitle = untitled ? trimmed.slice(0, 48) : session.title;
	const pending: ChatSession = {
		...session,
		title: nextTitle,
		updatedAt: nowIso(),
		scenarioId: session.scenarioId ?? getScenarioId(),
		screenId: session.screenId ?? getScreenId(),
		messages: [...session.messages, userMsg]
	};
	replaceSession(pending);
	saveMock(memory);
	abortInflight();
	const ac = new AbortController();
	inflight = ac;
	const token = epoch;
	try {
		const { result, status, modelId, live, usage } = await runConstructor(trimmed, ac.signal);
		if (token !== epoch) return getSelectedSession() ?? pending;
		capabilities = {
			runtime: status.runtime || "xai-grok",
			mode: result.ok && "source" in result && result.source === "local-catalog-assembler" ? "local-assembler" : status.code,
			liveModel: false,
			live: { requested: true, provider: "xai", model: modelId },
			tools: ["search_catalog", "get_block_details", "propose_layout", "get_skill"],
			note: runtimeNoteFor(status)
		};
		if (!result.ok) lastError = result.message;
		else lastError = null;
		const reply = proposalMessage(result, modelId, live, usage);
		const done: ChatSession = {
			...pending,
			updatedAt: nowIso(),
			selectedModelId: modelId,
			messages: [...pending.messages, reply],
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
	const session = getSelectedSession();
	if (!session) return false;
	const last = [...session.messages].reverse().find((m) => m.proposal && !m.proposal.applied);
	const ok = applyCandidate((getPageRevision() ?? 0) + 1);
	if (!ok) return false;
	const applied = getLastAppliedPage();
	const next: ChatSession = {
		...session,
		updatedAt: nowIso(),
		pageId: applied?.id,
		pageRevision: getPageRevision(),
		scenarioId: session.scenarioId ?? getScenarioId(),
		screenId: session.screenId ?? getScreenId(),
		messages: last
			? session.messages.map((m) =>
					m.id === last.id && m.proposal ? { ...m, proposal: { ...m.proposal, applied: true } } : m
				)
			: session.messages
	};
	replaceSession(next);
	saveMock(memory);
	return true;
}

export function discardProposal(): void {
	discardCandidate();
}

/**
 * Live ChatCore send via Session HTTP. Ordinary text never auto-saves a page.
 * Preserve requestId on retry of the same failed turn.
 */
export async function sendMessage(text: string, opts?: { requestId?: string; retry?: boolean }): Promise<ChatSession> {
	if (isMockMode()) return sendMessageMock(text);

	const trimmed = text.trim();
	if (!trimmed) {
		const current = getSelectedSession();
		if (current) return current;
		return createSession();
	}

	let session = getSelectedSession();
	if (!session) session = await createSession();

	const token = epoch;
	const requestId =
		opts?.retry && lastRequestId && lastFailedText === trimmed
			? lastRequestId
			: (opts?.requestId ?? newRequestId());
	lastRequestId = requestId;
	lastFailedText = trimmed;

	abortInflight();
	const ac = new AbortController();
	inflight = ac;

	try {
		const turn = await postMessageApi(
			session.id,
			{ content: trimmed, requestId },
			ac.signal
		);
		if (token !== epoch || selectedId !== session.id) {
			return getSelectedSession() ?? session;
		}

		let finalTurn = turn;
		if (turn.run.status === "pending") {
			finalTurn = await recoverRunApi(session.id, turn.run.id, ac.signal);
			if (token !== epoch || selectedId !== session.id) {
				return getSelectedSession() ?? session;
			}
		}
		return await commitTurn(session.id, finalTurn, token);
	} catch (err) {
		if ((err as Error).name === "AbortError") {
			return getSelectedSession() ?? session;
		}
		lastError = err instanceof GatewayRequestError ? err.message : t("runtime.sendFailed");
		throw err;
	} finally {
		if (inflight === ac) inflight = null;
	}
}

async function commitTurn(
	sessionId: string,
	turn: Awaited<ReturnType<typeof postMessageApi>>,
	token: number
): Promise<ChatSession> {
	if (token !== epoch || selectedId !== sessionId) {
		return getSelectedSession() ?? mapSession(turn.session, turn.messages);
	}
	const msgRes = await listMessagesApi(sessionId);
	if (token !== epoch || selectedId !== sessionId) {
		return getSelectedSession() ?? mapSession(turn.session, turn.messages);
	}
	const next = mapSession(turn.session, msgRes.messages);
	replaceSession(next);
	lastError = null;
	lastFailedText = null;
	if (turn.page?.page) {
		const page = pageFromTurn(turn);
		if (page) setCurrentPage(page, turn.page.revision);
	}
	return next;
}

export async function retryLastFailed(): Promise<ChatSession | null> {
	if (!lastFailedText || !lastRequestId) return null;
	return sendMessage(lastFailedText, { retry: true, requestId: lastRequestId });
}

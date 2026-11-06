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
import { t } from "../i18n/dictionary";
import translit from "../i18n/translit.json";
import { clearCurrentPage, loadMockFixturePage, setCurrentPage } from "../page-store";
import type { ChatMessage, ChatSession, SessionSummary } from "./types";

const STORE_KEY = "buildytech-chat-sessions";
const SELECTED_KEY = "buildy.creator.selectedSessionId";

function nowIso(): string {
	return new Date().toISOString();
}

function uid(prefix: string): string {
	return `${prefix}-${crypto.randomUUID()}`;
}

function slugify(text: string): string {
	const map = translit as Record<string, string>;
	const folded = text
		.toLowerCase()
		.split("")
		.map((ch) => map[ch] ?? ch)
		.join("");
	const slug = folded
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
	return slug || "page";
}

function loadMock(): ChatSession[] {
	if (typeof localStorage === "undefined") return [];
	try {
		const raw = localStorage.getItem(STORE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as ChatSession[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveMock(sessions: ChatSession[]): void {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(STORE_KEY, JSON.stringify(sessions));
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
		lastError = err instanceof GatewayRequestError ? err.message : t("runtime.loadFailed");
	} finally {
		if (inflight === ac) inflight = null;
	}
}

/** Load sessions from Session HTTP (or mock). Safe for onMount — not for $derived. */
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
				note: "Explicit ?mock=1 offline ChatCore"
			};
			const initial = loadMock();
			memory = initial;
			const preferred = readSelectedId();
			rememberSelection(
				preferred && initial.some((s) => s.id === preferred) ? preferred : (initial[0]?.id ?? null)
			);
			if (selectedId) loadMockFixturePage();
			else clearCurrentPage();
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
		const preferred = readSelectedId();
		const pick =
			preferred && sessions.some((s) => s.id === preferred) ? preferred : sessions[0]?.id ?? null;
		rememberSelection(pick);
		hydrated = true;
		if (pick) await loadSessionDetail(pick, token);
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

export function getRuntimeStatus(): {
	mode: "live" | "mock" | "booting";
	capabilities: ServerCapabilities | null;
	error: string | null;
	canDelete: boolean;
	lastRequestId: string | null;
} {
	return {
		mode: connectionMode,
		capabilities,
		error: lastError,
		canDelete: canDeleteSessions,
		lastRequestId
	};
}

export async function selectSession(id: string): Promise<void> {
	abortInflight();
	const token = bumpEpoch();
	rememberSelection(id);
	clearCurrentPage(); // clear stale DTO immediately
	// Clear messages visually until load completes by keeping summary-only entry
	const existing = memory.find((s) => s.id === id);
	if (existing) {
		replaceSession({ ...existing, messages: [] });
	}
	if (isMockMode()) {
		const full = loadMock().find((s) => s.id === id);
		if (full) replaceSession(full);
		loadMockFixturePage();
		return;
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
		saveMock(memory);
		loadMockFixturePage();
		return session;
	}
	const { session: raw } = await createSessionApi({});
	const session = mapSession(raw, []);
	replaceSession(session);
	rememberSelection(session.id);
	clearCurrentPage();
	void token;
	lastError = null;
	return session;
}

/** M4: Session HTTP has no DELETE — UI must stay disabled/truthful. */
export function deleteSession(_id: string): void {
	lastError = t("runtime.deleteUnavailable");
}

function assistantReply(userText: string): string {
	const slug = slugify(userText);
	return `${t("assistant.ack")} slug: ${slug}`;
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
		createdAt: nowIso()
	};
	const untitled = session.title === t("thread.untitled") || session.title === "New chat";
	const nextTitle = untitled ? trimmed.slice(0, 48) : session.title;
	const pending: ChatSession = {
		...session,
		title: nextTitle,
		updatedAt: nowIso(),
		messages: [...session.messages, userMsg]
	};
	replaceSession(pending);
	saveMock(memory);
	await new Promise((r) => setTimeout(r, 240));
	const reply: ChatMessage = {
		id: uid("msg"),
		role: "assistant",
		text: assistantReply(trimmed),
		createdAt: nowIso()
	};
	const done: ChatSession = {
		...pending,
		updatedAt: nowIso(),
		messages: [...pending.messages, reply]
	};
	replaceSession(done);
	saveMock(memory);
	return done;
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

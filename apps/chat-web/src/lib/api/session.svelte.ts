import { t } from "../i18n/dictionary";
import translit from "../i18n/translit.json";
import type { ChatMessage, ChatSession, SessionSummary } from "./types";

const STORE_KEY = "buildytech-chat-sessions";

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

function load(): ChatSession[] {
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

function save(sessions: ChatSession[]): void {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(STORE_KEY, JSON.stringify(sessions));
}

const canUseStorage = typeof localStorage !== "undefined";
const initialSessions = canUseStorage ? load() : [];

let memory = $state<ChatSession[]>(initialSessions);
let selectedId = $state<string | null>(initialSessions[0]?.id ?? null);
let hydrated = canUseStorage;

function persist(): void {
	save(memory);
}

/** Load from localStorage once. Safe for onMount / event handlers — not for $derived. */
function ensureHydrated(): void {
	if (hydrated) return;
	hydrated = true;
	memory = load();
	if (selectedId === null) selectedId = memory[0]?.id ?? null;
}

export function hydrateSessions(): void {
	ensureHydrated();
}

/** Pure read — do not mutate. Hydrate via hydrateSessions() / module init. */
export function listSessions(): SessionSummary[] {
	return memory
		.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Pure read — do not mutate. */
export function getSelectedSession(): ChatSession | null {
	return memory.find((s) => s.id === selectedId) ?? null;
}

export function selectSession(id: string): void {
	ensureHydrated();
	selectedId = id;
}

export function createSession(): ChatSession {
	ensureHydrated();
	const session: ChatSession = {
		id: uid("session"),
		title: t("thread.untitled"),
		updatedAt: nowIso(),
		messages: []
	};
	memory = [session, ...memory];
	selectedId = session.id;
	persist();
	return session;
}

export function deleteSession(id: string): void {
	ensureHydrated();
	memory = memory.filter((s) => s.id !== id);
	if (selectedId === id) {
		selectedId = memory[0]?.id ?? null;
	}
	persist();
}

function assistantReply(userText: string): string {
	const slug = slugify(userText);
	return `${t("assistant.ack")} slug: ${slug}`;
}

export async function sendMessage(text: string): Promise<ChatSession> {
	ensureHydrated();
	const trimmed = text.trim();
	if (!trimmed) {
		const current = getSelectedSession();
		if (current) return current;
		return createSession();
	}

	let session = getSelectedSession();
	if (!session) session = createSession();

	const userMsg: ChatMessage = {
		id: uid("msg"),
		role: "user",
		text: trimmed,
		createdAt: nowIso()
	};

	const untitled = session.title === t("thread.untitled");
	const nextTitle = untitled ? trimmed.slice(0, 48) : session.title;

	const pending: ChatSession = {
		...session,
		title: nextTitle,
		updatedAt: nowIso(),
		messages: [...session.messages, userMsg]
	};
	memory = memory.map((s) => (s.id === pending.id ? pending : s));
	persist();

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
	memory = memory.map((s) => (s.id === done.id ? done : s));
	persist();
	return done;
}

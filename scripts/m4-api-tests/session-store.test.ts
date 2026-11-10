/**
 * Session standard (ADR 0015): the buildy:v1 key space and its one-time migration, schema validation at load with
 * quarantine, the portable session file buildy:v1 (export / import checks, Lab shape), and page revisions (one per
 * committed edit, coalesced typing = one revision = one undo step, session.pageRevision in sync, unchanged = no-op).
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	LEGACY_STORAGE_KEYS,
	STORAGE_KEYS,
	migrateLegacyStorage,
	quarantine,
	readQuarantine
} from "../../apps/chat-web/src/lib/browser/storage-v1.ts";
import {
	clearPersistError,
	getPersistError,
	loadPagesBlob,
	loadSessionsJson,
	useStorageForTests
} from "../../apps/chat-web/src/lib/browser/persist.ts";
import {
	buildSessionFile,
	parseSessionFile,
	reconcileChatRevision,
	recordRevision,
	splitSessionFile
} from "../../apps/chat-web/src/lib/browser/session-file.ts";
import { commitChange, nextRevision } from "../../apps/chat-web/src/lib/page-store/revision.ts";
import { EditHistory } from "../../apps/chat-web/src/lib/inspector/history.ts";
import { inspectorSetField, proposeLayout } from "../../packages/builder-core/src/index.ts";
import type { Page } from "../../packages/page-contract/src/index.ts";
import { SESSION_MAX_HISTORY, sessionDefIssues, sessionFileIssues, sessionSchema } from "../../packages/page-contract/src/session.ts";

class MemoryStorage {
	map = new Map<string, string>();
	refuse = new Set<string>();
	getItem(key: string): string | null {
		return this.map.has(key) ? this.map.get(key)! : null;
	}
	setItem(key: string, value: string): void {
		if (this.refuse.has(key)) {
			const err = new Error("quota") as Error & { name: string };
			err.name = "QuotaExceededError";
			throw err;
		}
		this.map.set(key, String(value));
	}
	removeItem(key: string): void {
		this.map.delete(key);
	}
	snapshot(): Record<string, string> {
		return Object.fromEntries([...this.map.entries()].sort(([a], [b]) => a.localeCompare(b)));
	}
}

const NOW = "2026-11-10T12:00:00.000Z";
const store = new MemoryStorage();
useStorageForTests(store);
afterEach(() => {
	store.map.clear();
	store.refuse.clear();
	clearPersistError();
	useStorageForTests(store);
});

function landing(): Page {
	const r = proposeLayout({ brief: "Landing for a coffee house", scenarioId: "landing", screenId: null, expectedRevision: 0, now: NOW, content: { locale: "en", blocks: [] } });
	assert.ok(r.ok, JSON.stringify(r));
	return r.page;
}

const chat = (id: string, extra: Record<string, unknown> = {}) => ({
	id,
	title: "Coffee house",
	updatedAt: NOW,
	mode: "build",
	messages: [
		{ id: "msg-1", role: "user", text: "Landing for a coffee house", createdAt: NOW, mode: "build", selectedModelId: "grok-4" },
		{
			id: "msg-2",
			role: "assistant",
			text: "Proposal ready",
			createdAt: NOW,
			proposal: { applied: true, status: "applied", source: "xai", liveModel: true, warnings: [], missing: [], title: "Coffee", catalogRefs: { catalogDigest: "sha256:x", pinnedCommit: "081a1c5", screen: null, blocks: [] } },
			run: { requestedModelId: "grok-4", modelId: "grok-4", modelLabel: "Grok 4", live: true, policyVersion: "1", modelCatalogVersion: "1", trialPolicyVersion: "1", usage: { status: "complete", steps: 2, promptTokens: 10, completionTokens: 5, totalTokens: 15, reportedBy: "xai-provider" } }
		}
	],
	...extra
});

const pins = {
	stock: { repo: "codegen-x/ui8kit", contentCommit: "081a1c5e5cc5db6f6439a37edb666ddfee7aa006" },
	registry: { url: "https://registry.buildy.tw", sourceCommit: "3a6d923a3bdf75bba8951a3dfda7f3e97a69ecc5" },
	catalogDigest: "sha256:78a567cf"
};
const app = { name: "buildy-chat", version: "0.0.0", host: "browser" as const };

// ---- buildy:v1 key space and the one-time migration ---------------------------------------------------------------

test("migration: every legacy key moves to buildy:v1 unchanged, the legacy key is removed, a marker is written", () => {
	const values: Record<string, string> = {};
	for (const legacy of Object.keys(LEGACY_STORAGE_KEYS)) {
		values[legacy] = JSON.stringify({ from: legacy });
		store.setItem(legacy, values[legacy]!);
	}
	const report = migrateLegacyStorage(store, () => NOW);
	assert.deepEqual(report.moved.sort(), Object.keys(LEGACY_STORAGE_KEYS).sort());
	for (const [legacy, next] of Object.entries(LEGACY_STORAGE_KEYS)) {
		assert.equal(store.getItem(legacy), null, legacy);
		assert.equal(store.getItem(next), values[legacy], next);
		assert.ok(next.startsWith("buildy:v1:"));
	}
	assert.equal(JSON.parse(store.getItem(STORAGE_KEYS.migration)!).version, 1);
});

test("migration is idempotent: a second run writes nothing", () => {
	store.setItem("buildytech-chat-sessions", "[]");
	store.setItem("buildytech-chat-theme", "dark");
	migrateLegacyStorage(store, () => NOW);
	const after = store.snapshot();
	const again = migrateLegacyStorage(store, () => "2030-01-01T00:00:00.000Z");
	assert.deepEqual(again, { moved: [], same: [], conflicts: [], failed: [] });
	assert.deepEqual(store.snapshot(), after);
});

test("migration never loses data: a conflicting legacy value goes to quarantine, a refused write keeps the legacy key", () => {
	store.setItem(STORAGE_KEYS.theme, "light");
	store.setItem("buildytech-chat-theme", "dark");
	const conflict = migrateLegacyStorage(store, () => NOW);
	assert.deepEqual(conflict.conflicts, ["buildytech-chat-theme"]);
	assert.equal(store.getItem(STORAGE_KEYS.theme), "light", "the buildy:v1 value wins");
	assert.deepEqual(readQuarantine(store).map((q) => [q.key, q.reason, q.raw]), [["buildytech-chat-theme", "legacy_conflict", "dark"]]);

	store.map.clear();
	store.setItem("buildytech-chat-sessions", "[1]");
	store.refuse.add(STORAGE_KEYS.sessions);
	const refused = migrateLegacyStorage(store, () => NOW);
	assert.deepEqual(refused.failed, ["buildytech-chat-sessions"]);
	assert.equal(store.getItem("buildytech-chat-sessions"), "[1]", "retried on the next load");
});

test("app source reads and writes only buildy:v1 keys (legacy names live in storage-v1.ts only)", () => {
	const root = new URL("../../apps/chat-web/src/", import.meta.url).pathname;
	const files: string[] = [];
	const walk = (dir: string) => {
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			if (statSync(path).isDirectory()) walk(path);
			else if (/\.(ts|svelte)$/.test(name)) files.push(path);
		}
	};
	walk(root);
	for (const file of files) {
		if (file.endsWith("storage-v1.ts")) continue;
		const text = readFileSync(file, "utf8");
		for (const legacy of Object.keys(LEGACY_STORAGE_KEYS)) assert.ok(!text.includes(`"${legacy}"`), `${file} uses ${legacy}`);
		assert.doesNotMatch(text, /localStorage\.(get|set|remove)Item/, `${file} bypasses storage-v1`);
	}
});

// ---- validation at load and quarantine ---------------------------------------------------------------------------

test("load: chats are checked against session.schema.json; an invalid chat is quarantined, the others load", () => {
	const good = chat("session-a");
	const bad = { ...chat("session-b"), apiKey: "not-a-session-field" };
	store.setItem(STORAGE_KEYS.sessions, JSON.stringify([good, bad]));
	const loaded = loadSessionsJson();
	assert.deepEqual(loaded, [good]);
	const q = readQuarantine(store);
	assert.equal(q.length, 1);
	assert.match(q[0]!.reason, /^session_invalid:additionalProperties$/);
	assert.deepEqual(JSON.parse(q[0]!.raw), bad, "kept as it was");
	assert.deepEqual(JSON.parse(store.getItem(STORAGE_KEYS.sessions)!), [good], "rewritten without it");
	assert.equal(getPersistError()?.code, "corrupt");
	assert.deepEqual(loadSessionsJson(), [good], "a second load quarantines nothing new");
	assert.equal(readQuarantine(store).length, 1);
});

test("load: unreadable chats JSON is quarantined whole and the key starts empty", () => {
	store.setItem(STORAGE_KEYS.sessions, "{not-json");
	assert.deepEqual(loadSessionsJson(), []);
	assert.deepEqual(readQuarantine(store).map((q) => [q.key, q.reason, q.raw]), [[STORAGE_KEYS.sessions, "corrupt", "{not-json"]]);
	assert.equal(store.getItem(STORAGE_KEYS.sessions), "[]");
});

test("load: a page record the page-spec schema rejects is quarantined; valid records load", () => {
	const page = landing();
	const ok = { applied: page, candidate: null, selectedBlockId: null, revision: 2 };
	const broken = { applied: { ...page, layout: { version: 2, blocks: [] } }, candidate: null, selectedBlockId: null, revision: 1 };
	store.setItem(STORAGE_KEYS.pages, JSON.stringify({ version: 1, pages: { "session-a": ok, "session-b": broken } }));
	const blob = loadPagesBlob();
	assert.deepEqual(Object.keys(blob.pages), ["session-a"]);
	const q = readQuarantine(store);
	assert.equal(q.length, 1);
	assert.match(q[0]!.reason, /^page_record_invalid:/);
	assert.match(q[0]!.path ?? "", /^\$\.pages\.session-b/);
});

test("quarantine keeps a broken quarantine blob instead of overwriting it", () => {
	store.setItem(STORAGE_KEYS.quarantine, "oops");
	assert.ok(quarantine(store, { key: "k", reason: "r", raw: "v" }));
	const q = readQuarantine(store);
	assert.deepEqual(q.map((e) => e.raw), ["oops", "v"]);
});

// ---- session file buildy:v1 ----------------------------------------------------------------------------------------

test("export: a real chat with its page is a schema-valid buildy:v1 file with pins and app; pageRevision follows the page", () => {
	const page = landing();
	const file = buildSessionFile({
		chats: [chat("session-a", { pageRevision: 1, history: [{ revision: 1, at: NOW, cause: "apply", pageId: page.id }] })],
		pages: { "session-a": { applied: page, candidate: null, selectedBlockId: "block-hero", revision: 3 } },
		selectedSessionId: "session-a",
		app,
		pins,
		settings: { theme: "dark", selectedModelId: "grok-4", previewHideServiceLabels: true },
		now: NOW
	});
	assert.deepEqual(sessionFileIssues(file), []);
	assert.equal(file.format, "buildy:v1");
	assert.equal(file.$schema, "https://schema.buildy.tw/session.schema.json");
	assert.equal(file.sessions[0]!.pageRevision, 3, "the page store revision wins");
	assert.equal(file.sessions[0]!.page?.revision, 3);
	const parsed = parseSessionFile(JSON.stringify(file));
	assert.ok(parsed.ok, JSON.stringify(parsed));
	const { chats, pages } = splitSessionFile(parsed.file);
	assert.equal(chats[0]!.id, "session-a");
	assert.equal((pages["session-a"]!.applied as Page).id, page.id);
	// Lab BuildY (lab-console importer.go) reads {"sessions":[{id,title,updatedAt,messages:[{id,role,text,createdAt,proposal,run}]}]}.
	const lab = JSON.parse(JSON.stringify(file)) as { sessions: { id: string; title: string; updatedAt: string; messages: { id: string; role: string; text: string; createdAt: string; run?: { modelId: string } }[] }[] };
	assert.equal(lab.sessions[0]!.messages[1]!.run?.modelId, "grok-4");
});

test("import checks: bad JSON, wrong format, unknown or secret-looking fields and program checks are refused", () => {
	const page = landing();
	const base = buildSessionFile({ chats: [chat("session-a")], pages: { "session-a": { applied: page, candidate: null, selectedBlockId: null, revision: 1 } }, selectedSessionId: null, app, pins, now: NOW });
	assert.equal(parseSessionFile("{").ok, false);
	const code = (v: unknown) => {
		const r = parseSessionFile(v);
		return r.ok ? "ok" : r.code;
	};
	assert.equal(code("{"), "invalid_json");
	assert.equal(code({ ...base, format: "buildy:v2" }), "schema_invalid");
	assert.equal(code({ ...base, xaiApiKey: "x" }), "schema_invalid", "closed root: no credential slot");
	assert.equal(code({ ...base, sessions: [{ ...base.sessions[0]!, mode: "plan" }] }), "schema_invalid");
	assert.equal(code({ ...base, sessions: [{ ...base.sessions[0]!, pageRevision: 7 }] }), "program_invalid", "page_revision_mismatch");
	assert.equal(code({ ...base, sessions: [base.sessions[0]!, base.sessions[0]!] }), "program_invalid", "duplicate_session_id");
	assert.equal(code({ ...base, selectedSessionId: "session-zzz" }), "program_invalid", "selected_session_unknown");
	const backwards = [{ revision: 2, at: NOW, cause: "edit" }, { revision: 1, at: NOW, cause: "undo" }];
	assert.equal(code({ ...base, sessions: [{ ...base.sessions[0]!, pageRevision: 2, page: { ...base.sessions[0]!.page!, revision: 2 }, history: backwards }] }), "program_invalid");
	assert.equal(code(base), "ok");
});

test("the vendored session schema stays inside the dependency-free checker's keyword subset and has no credential field", () => {
	const text = JSON.stringify(sessionSchema);
	assert.doesNotMatch(text, /"format":\s*"(date-time|uri|email)"/);
	assert.doesNotMatch(text, /apiKey|password|token"/i);
	assert.deepEqual(sessionDefIssues({ revision: 1, at: NOW, cause: "edit" }, "revisionEntry"), []);
	assert.notDeepEqual(sessionDefIssues({ revision: 1, at: NOW, cause: "import" }, "revisionEntry"), []);
});

// ---- revisions ---------------------------------------------------------------------------------------------------

/** The inspector commit path without Svelte: EditHistory decides extend vs edit, nextRevision counts. */
function simulate() {
	const history = new EditHistory<string>();
	let page = "p0";
	let revision: number | null = 1;
	const causes: string[] = [];
	const write = (next: string, key: string | null, onApplied = true) => {
		const step = nextRevision(revision, commitChange(history.continues(key)), onApplied);
		if (onApplied) revision = step.revision;
		if (step.cause) causes.push(step.cause);
		history.record(page, next, key);
		page = next;
	};
	return {
		type(field: string, text: string) {
			for (let i = 1; i <= text.length; i++) write(`${field}=${text.slice(0, i)}`, field);
		},
		op(name: string) {
			history.seal();
			write(`op:${name}`, null);
		},
		seal: () => history.seal(),
		undo() {
			const before = history.undo();
			if (before === null) return;
			const step = nextRevision(revision, "undo", true);
			revision = step.revision;
			causes.push(step.cause!);
			page = before;
		},
		get revision() {
			return revision;
		},
		causes,
		history
	};
}

test("revisions: typing a word in one field is one revision and one undo step, not one per keystroke", () => {
	const s = simulate();
	s.type("hero.title", "Hello");
	assert.equal(s.revision, 2, "5 keystrokes, 1 revision");
	assert.deepEqual(s.causes, ["edit"]);
	s.seal();
	s.type("hero.lede", "Fresh");
	assert.equal(s.revision, 3);
	s.op("move");
	assert.equal(s.revision, 4);
	assert.deepEqual(s.causes, ["edit", "edit", "edit"], "one revision per undo step");
	let steps = 0;
	while (s.history.canUndo) {
		s.history.undo();
		steps += 1;
	}
	assert.equal(steps, 3, "undo steps = committed edits = revisions after the first");
});

test("revisions: undo is a committed change (next revision); edits of a pending proposal add none", () => {
	const s = simulate();
	s.type("hero.title", "Hi");
	s.seal();
	s.undo();
	assert.equal(s.revision, 3);
	assert.deepEqual(s.causes, ["edit", "undo"]);
	assert.deepEqual(nextRevision(4, "edit", false), { revision: 4, cause: null }, "pending proposal");
	assert.deepEqual(nextRevision(null, "extend", true), { revision: 1, cause: "edit" }, "first write of an unrevisioned page");
});

test("revisions: an unchanged value is a no-op (same page object, so no step and no revision)", () => {
	const page = landing();
	const first = inspectorSetField(page, "block-hero", "/title", "Fresh coffee", NOW);
	assert.ok(first.ok);
	const again = inspectorSetField(first.page, "block-hero", "/title", "Fresh coffee", NOW);
	assert.ok(again.ok);
	assert.equal(again.page, first.page);
	const store = readFileSync(new URL("../../apps/chat-web/src/lib/inspector/inspector.svelte.ts", import.meta.url), "utf8");
	assert.match(store, /if \(result\.page === before\) return true;/, "commit stops before replaceVisiblePage");
	assert.match(store, /commitChange\(steps\.continues\(key\)\)/, "coalesced typing keeps the revision");
});

test("session.pageRevision stays in sync: every revision event records it with one history entry; load reconciles drift", () => {
	let c = chat("session-a", { pageRevision: 1 }) as ReturnType<typeof chat> & { pageRevision: number | null; history?: { revision: number }[] };
	c = recordRevision(c, { revision: 2, at: NOW, cause: "edit", pageId: "page-a", blockId: "block-hero" });
	c = recordRevision(c, { revision: 3, at: NOW, cause: "undo", pageId: "page-a" });
	assert.equal(c.pageRevision, 3);
	assert.deepEqual(c.history?.map((h) => h.revision), [2, 3]);
	const drifted = { ...c, pageRevision: 9 };
	assert.equal(reconcileChatRevision(drifted, { applied: {}, candidate: null, selectedBlockId: null, revision: 3 }).pageRevision, 3);
	assert.equal(reconcileChatRevision(c, { applied: {}, candidate: null, selectedBlockId: null, revision: 3 }), c, "in sync: same object");
	assert.equal(reconcileChatRevision(c, undefined), c, "no page record: untouched");
	let long = c;
	for (let r = 4; r < 4 + SESSION_MAX_HISTORY + 10; r++) long = recordRevision(long, { revision: r, at: NOW, cause: "edit" });
	assert.equal(long.history?.length, SESSION_MAX_HISTORY);
	assert.equal(long.history?.at(-1)?.revision, long.pageRevision);
});

test("page store and chat store are wired: applyCandidate and replaceVisiblePage announce, the chat records", () => {
	const web = (p: string) => readFileSync(new URL(`../../apps/chat-web/src/${p}`, import.meta.url), "utf8");
	const pages = web("lib/page-store/mock.svelte.ts");
	assert.match(pages, /announce\("apply"\)/);
	assert.match(pages, /nextRevision\(pageRevision, change, !candidatePage\)/);
	const chats = web("lib/chat-core/session.svelte.ts");
	assert.match(chats, /onPageRevision\(\(event\) =>/);
	assert.match(chats, /recordRevision\(/);
	assert.match(chats, /reconcileChatRevision\(/);
});

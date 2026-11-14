import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
	PAGES_KEY,
	SESSIONS_KEY,
	allowPersistOverwrite,
	clearPersistError,
	getPersistError,
	loadPagesBlob,
	loadSessionsJson,
	clearPagesBlob,
	deleteProjectPage,
	normalizePageRecord,
	readProjectPage,
	saveSessionsJson,
	writeProjectPage
} from "../../apps/chat-web/src/lib/browser/persist.ts";

class MemoryStorage {
	map = new Map<string, string>();
	quota = false;
	getItem(key: string): string | null {
		return this.map.has(key) ? this.map.get(key)! : null;
	}
	setItem(key: string, value: string): void {
		if (this.quota) {
			const err = new Error("quota") as Error & { name: string; code: number };
			err.name = "QuotaExceededError";
			err.code = 22;
			throw err;
		}
		this.map.set(key, String(value));
	}
	removeItem(key: string): void {
		this.map.delete(key);
	}
	clear(): void {
		this.map.clear();
	}
	get length(): number {
		return this.map.size;
	}
	key(index: number): string | null {
		return [...this.map.keys()][index] ?? null;
	}
}

const memory = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", {
	configurable: true,
	value: memory
});

afterEach(() => {
	memory.quota = false;
	memory.clear();
	clearPersistError();
});

test("existing session arrays keep loading from the original key", () => {
	const previous = [{ id: "session-1", title: "Barbecue", updatedAt: "2026-11-08T00:00:00.000Z", messages: [] }];
	memory.setItem(SESSIONS_KEY, JSON.stringify(previous));
	const loaded = loadSessionsJson();
	assert.deepEqual(loaded, previous);
	assert.equal(getPersistError(), null);
});

test("corrupt session JSON is kept in quarantine before the key is reused (ADR 0015)", () => {
	memory.setItem(SESSIONS_KEY, "{not-json");
	const loaded = loadSessionsJson();
	assert.deepEqual(loaded, []);
	assert.equal(getPersistError()?.code, "corrupt");
	assert.equal(JSON.parse(memory.getItem("buildy:v1:quarantine")!)[0].raw, "{not-json", "the unreadable value is kept");
	assert.equal(saveSessionsJson([{ id: "session-x" }]), true);
	assert.deepEqual(loadSessionsJson(), [{ id: "session-x" }]);
});

test("when even the quarantine write is refused, the corrupt value is frozen, not overwritten", () => {
	memory.setItem(SESSIONS_KEY, "{not-json");
	memory.quota = true;
	assert.deepEqual(loadSessionsJson(), []);
	memory.quota = false;
	assert.equal(saveSessionsJson([{ id: "session-x" }]), false);
	assert.equal(memory.getItem(SESSIONS_KEY), "{not-json");
	allowPersistOverwrite();
	assert.equal(saveSessionsJson([{ id: "session-x" }]), true);
});

test("pages are stored per session and discard does not need a write of applied", () => {
	assert.equal(writeProjectPage("session-1", {
		applied: { id: "page-a" },
		candidate: { id: "page-b" },
		selectedBlockId: "block-hero",
		revision: 2
	}), true);
	const rec = readProjectPage("session-1");
	assert.equal(rec?.revision, 2);
	assert.equal((rec?.applied as { id: string }).id, "page-a");
	assert.equal(readProjectPage("session-2"), null);
	assert.equal(loadPagesBlob().version, 1);
	assert.ok(memory.getItem(PAGES_KEY)?.includes("session-1"));
});

test("QA can delete a session's pages or clear the pages blob", () => {
	assert.equal(writeProjectPage("session-1", { applied: { id: "page-a" }, candidate: null, selectedBlockId: null, revision: 1 }), true);
	assert.equal(writeProjectPage("session-2", { applied: { id: "page-b" }, candidate: null, selectedBlockId: null, revision: 1 }), true);
	assert.equal(deleteProjectPage("session-1"), true);
	assert.equal(readProjectPage("session-1"), null);
	assert.equal(readProjectPage("session-2")?.revision, 1);
	assert.equal(clearPagesBlob(), true);
	assert.equal(readProjectPage("session-2"), null);
	assert.equal(loadPagesBlob().version, 1);
});

test("the sibling provenance of a stored record is complete; an unknown scenario id is dropped", () => {
	const blank = normalizePageRecord({ applied: { id: "page-b", blocks: [] }, candidate: null, selectedBlockId: null, revision: 1 });
	assert.equal(blank.appliedProvenance?.screenId, null);
	const junk = normalizePageRecord(
		JSON.parse(JSON.stringify({ applied: { id: "page-c" }, candidate: null, appliedProvenance: { screenId: "screen.site/home", scenarioId: "wordpress", missing: [] }, selectedBlockId: null, revision: 1 }))
	);
	assert.equal(junk.appliedProvenance?.scenarioId, null);
	assert.equal(junk.appliedProvenance?.screenId, "screen.site/home");
	const landing = normalizePageRecord({ applied: { id: "page-d" }, candidate: null, appliedProvenance: { screenId: "screen.site/home", scenarioId: "landing", missing: [] }, selectedBlockId: null, revision: 1 });
	assert.equal(landing.appliedProvenance?.scenarioId, "landing");
});

test("a stored page-spec/v1 record is quarantined as page_v1_unsupported, the rest of the blob loads (ADR 0045)", () => {
	const v2 = { applied: { version: 2, id: "page-ok", slug: "ok", status: "draft", title: "Ok", locale: "en", seo: { title: "Ok", description: "Ok" }, createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z", blocks: [] }, candidate: null, selectedBlockId: null, revision: 1 };
	const v1 = { applied: { id: "page-old", layout: { version: 1, blocks: [] } }, candidate: null, selectedBlockId: null, revision: 1 };
	memory.setItem(PAGES_KEY, JSON.stringify({ version: 1, pages: { "session-ok": v2, "session-old": v1 } }));
	const blob = loadPagesBlob();
	assert.deepEqual(Object.keys(blob.pages), ["session-ok"]);
	assert.equal(getPersistError()?.code, "corrupt");
	const quarantined = JSON.parse(memory.getItem("buildy:v1:quarantine")!) as Array<{ reason: string; raw: string; path?: string }>;
	assert.equal(quarantined.length, 1);
	assert.equal(quarantined[0]!.reason, "page_v1_unsupported");
	assert.equal(quarantined[0]!.path, "$.pages.session-old");
	assert.deepEqual(JSON.parse(quarantined[0]!.raw), v1, "the whole record is kept, nothing dropped silently");
});

test("quota errors are truthful and leave the last good blob", () => {
	assert.equal(saveSessionsJson([{ id: "session-1" }]), true);
	memory.quota = true;
	assert.equal(saveSessionsJson([{ id: "session-2" }]), false);
	assert.equal(getPersistError()?.code, "quota");
	memory.quota = false;
	assert.deepEqual(loadSessionsJson(), [{ id: "session-1" }]);
});

// ---- ADR 0024 step D fix: "Start page from this screen" proposals --------------------------------------------------

const NOW_D = "2026-11-11T17:00:00.000Z";
const screenChat = (origin?: string) => ({
	id: "session-screen",
	title: "Bakery",
	updatedAt: NOW_D,
	mode: "build",
	messages: [
		{
			id: "msg-1",
			role: "assistant",
			text: "Started a page from the screen",
			createdAt: NOW_D,
			proposal: {
				applied: true,
				status: "applied",
				source: "local-catalog-assembler",
				liveModel: false,
				warnings: [],
				missing: [],
				title: "Bakery",
				catalogRefs: { catalogDigest: "sha256:x", pinnedCommit: "081a1c5", screen: null, blocks: [] },
				...(origin ? { origin } : {})
			}
		}
	]
});

test("a session from 'Start page from this screen' is schema-valid and survives a reload", () => {
	memory.setItem(SESSIONS_KEY, JSON.stringify([screenChat()]));
	assert.deepEqual(loadSessionsJson(), [screenChat()]);
	assert.equal(getPersistError(), null, "nothing goes to quarantine");
	assert.equal(memory.getItem("buildy:v1:quarantine"), null);
});

test("chats saved with the retired origin 'feed-screen' are quarantined, not repaired (ADR 0045)", () => {
	memory.setItem(SESSIONS_KEY, JSON.stringify([screenChat("feed-screen"), screenChat("ask-plan")].map((c, i) => ({ ...c, id: `session-${i}` }))));
	const loaded = loadSessionsJson() as Array<{ id: string }>;
	assert.deepEqual(loaded.map((c) => c.id), ["session-1"], "the valid chat loads");
	assert.equal(getPersistError()?.code, "corrupt");
	const quarantined = JSON.parse(memory.getItem("buildy:v1:quarantine")!) as Array<{ reason: string; raw: string }>;
	assert.equal(quarantined.length, 1);
	assert.match(quarantined[0]!.reason, /^session_invalid:/);
	assert.equal((JSON.parse(quarantined[0]!.raw) as { id: string }).id, "session-0", "the refused chat is kept whole");
});

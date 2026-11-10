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
	deleteSessionPages,
	migrateStoredPageRecord,
	readSessionPages,
	saveSessionsJson,
	writeSessionPages
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
	assert.equal(writeSessionPages("session-1", {
		applied: { id: "page-a" },
		candidate: { id: "page-b" },
		selectedBlockId: "block-hero",
		revision: 2
	}), true);
	const rec = readSessionPages("session-1");
	assert.equal(rec?.revision, 2);
	assert.equal((rec?.applied as { id: string }).id, "page-a");
	assert.equal(readSessionPages("session-2"), null);
	assert.equal(loadPagesBlob().version, 1);
	assert.ok(memory.getItem(PAGES_KEY)?.includes("session-1"));
});

test("QA can delete a session's pages or clear the pages blob", () => {
	assert.equal(writeSessionPages("session-1", { applied: { id: "page-a" }, candidate: null, selectedBlockId: null, revision: 1 }), true);
	assert.equal(writeSessionPages("session-2", { applied: { id: "page-b" }, candidate: null, selectedBlockId: null, revision: 1 }), true);
	assert.equal(deleteSessionPages("session-1"), true);
	assert.equal(readSessionPages("session-1"), null);
	assert.equal(readSessionPages("session-2")?.revision, 1);
	assert.equal(clearPagesBlob(), true);
	assert.equal(readSessionPages("session-2"), null);
	assert.equal(loadPagesBlob().version, 1);
});

test("old saved pages migrate Stock provenance from CTA note, else none attached", () => {
	const withNote = migrateStoredPageRecord({
		applied: {
			id: "page-a",
			layout: { version: 1, blocks: [{ id: "block-cta", kind: "cta", title: "CTA", summary: "", copy: { note: "Stock screen screen.site/home" } }] }
		},
		candidate: null,
		selectedBlockId: null,
		revision: 1
	});
	assert.equal(withNote.appliedProvenance?.screenId, "screen.site/home");
	const blank = migrateStoredPageRecord({
		applied: { id: "page-b", layout: { version: 1, blocks: [{ id: "block-hero", kind: "hero", title: "Hero", summary: "" }] } },
		candidate: null,
		selectedBlockId: null,
		revision: 1
	});
	assert.equal(blank.appliedProvenance?.screenId, null);
	assert.equal(blank.appliedProvenance?.screenId ?? "none attached", "none attached");
	const junk = migrateStoredPageRecord(
		JSON.parse(
			JSON.stringify({
				applied: { id: "page-c" },
				candidate: null,
				appliedProvenance: { screenId: "screen.site/home", scenarioId: "wordpress", missing: [] },
				selectedBlockId: null,
				revision: 1
			})
		)
	);
	assert.equal(junk.appliedProvenance?.scenarioId, null);
	const landing = migrateStoredPageRecord({
		applied: { id: "page-d" },
		candidate: null,
		appliedProvenance: { screenId: "screen.site/home", scenarioId: "landing", missing: [] },
		selectedBlockId: null,
		revision: 1
	});
	assert.equal(landing.appliedProvenance?.scenarioId, "landing");
});

test("quota errors are truthful and leave the last good blob", () => {
	assert.equal(saveSessionsJson([{ id: "session-1" }]), true);
	memory.quota = true;
	assert.equal(saveSessionsJson([{ id: "session-2" }]), false);
	assert.equal(getPersistError()?.code, "quota");
	memory.quota = false;
	assert.deepEqual(loadSessionsJson(), [{ id: "session-1" }]);
});

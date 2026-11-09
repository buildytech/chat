import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
	PAGES_KEY,
	SESSIONS_KEY,
	clearPersistError,
	getPersistError,
	loadPagesBlob,
	loadSessionsJson,
	clearPagesBlob,
	deleteSessionPages,
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

test("corrupt session JSON is not overwritten", () => {
	memory.setItem(SESSIONS_KEY, "{not-json");
	const loaded = loadSessionsJson();
	assert.deepEqual(loaded, []);
	assert.equal(getPersistError()?.code, "corrupt");
	assert.equal(memory.getItem(SESSIONS_KEY), "{not-json");
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

test("quota errors are truthful and leave the last good blob", () => {
	assert.equal(saveSessionsJson([{ id: "session-1" }]), true);
	memory.quota = true;
	assert.equal(saveSessionsJson([{ id: "session-2" }]), false);
	assert.equal(getPersistError()?.code, "quota");
	memory.quota = false;
	assert.deepEqual(loadSessionsJson(), [{ id: "session-1" }]);
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	readSessionQuery,
	resolveSessionSelection,
	syncSessionQuery
} from "../../apps/chat-web/src/lib/api/session-url.ts";

describe("resolveSessionSelection", () => {
	it("explicit URL session wins over persisted and first", () => {
		const pick = resolveSessionSelection({
			urlSession: "sess-url",
			persistedId: "sess-persisted",
			sessionIds: ["sess-first", "sess-persisted", "sess-url"]
		});
		assert.deepEqual(pick, { kind: "ok", id: "sess-url", source: "url" });
	});

	it("falls back to persisted when URL absent", () => {
		const pick = resolveSessionSelection({
			urlSession: null,
			persistedId: "sess-persisted",
			sessionIds: ["sess-first", "sess-persisted"]
		});
		assert.deepEqual(pick, { kind: "ok", id: "sess-persisted", source: "persisted" });
	});

	it("falls back to first when URL and persisted absent", () => {
		const pick = resolveSessionSelection({
			urlSession: null,
			persistedId: null,
			sessionIds: ["sess-a", "sess-b"]
		});
		assert.deepEqual(pick, { kind: "ok", id: "sess-a", source: "first" });
	});

	it("missing URL session does not silently pick another", () => {
		const pick = resolveSessionSelection({
			urlSession: "sess-gone",
			persistedId: "sess-persisted",
			sessionIds: ["sess-persisted", "sess-other"]
		});
		assert.deepEqual(pick, { kind: "missing", requested: "sess-gone" });
	});

	it("empty catalog with URL is missing", () => {
		const pick = resolveSessionSelection({
			urlSession: "sess-x",
			persistedId: null,
			sessionIds: []
		});
		assert.deepEqual(pick, { kind: "missing", requested: "sess-x" });
	});

	it("empty catalog without URL is none", () => {
		const pick = resolveSessionSelection({
			urlSession: null,
			persistedId: "sess-x",
			sessionIds: []
		});
		assert.deepEqual(pick, { kind: "none" });
	});
});

describe("readSessionQuery", () => {
	it("reads session param", () => {
		assert.equal(readSessionQuery("?session=sess-1&mock=1"), "sess-1");
		assert.equal(readSessionQuery("?mock=1"), null);
		assert.equal(readSessionQuery(""), null);
	});
});

describe("syncSessionQuery", () => {
	it("sets session while preserving mock flag", () => {
		const next = syncSessionQuery("sess-new", {
			href: "http://127.0.0.1:5173/?mock=1&session=sess-old"
		});
		assert.equal(next, "/?mock=1&session=sess-new");
	});

	it("clears session while preserving mock flag", () => {
		const next = syncSessionQuery(null, {
			href: "http://127.0.0.1:5173/?session=sess-old&mock=1"
		});
		assert.equal(next, "/?mock=1");
	});
});

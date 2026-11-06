import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapMessages, parseServerPage } from "../../apps/chat-web/src/lib/api/map.ts";
import type { ServerMessage } from "../../apps/chat-web/src/lib/api/gateway.ts";

describe("mapMessages", () => {
	it("does not invent artifacts without save_page tool", () => {
		const msgs: ServerMessage[] = [
			{ id: "1", sessionId: "s", seq: 1, role: "user", content: "hi", createdAt: "2026-01-01T00:00:00Z" },
			{ id: "2", sessionId: "s", seq: 2, role: "assistant", content: "ack", createdAt: "2026-01-01T00:00:01Z" }
		];
		const mapped = mapMessages(msgs);
		assert.equal(mapped.length, 2);
		assert.equal(mapped[1]?.artifacts, undefined);
	});

	it("attaches confirmed save_page artifact to following assistant message", () => {
		const msgs: ServerMessage[] = [
			{ id: "1", sessionId: "s", seq: 1, role: "user", content: "save", createdAt: "2026-01-01T00:00:00Z" },
			{
				id: "2",
				sessionId: "s",
				seq: 2,
				role: "tool",
				content: JSON.stringify({ tool: "save_page", pageId: "page-a", revision: 1, slug: "home" }),
				createdAt: "2026-01-01T00:00:01Z"
			},
			{ id: "3", sessionId: "s", seq: 3, role: "assistant", content: "saved", createdAt: "2026-01-01T00:00:02Z" }
		];
		const mapped = mapMessages(msgs);
		assert.equal(mapped.length, 2);
		assert.equal(mapped[1]?.artifacts?.[0]?.kind, "saved_page");
		assert.equal(mapped[1]?.artifacts?.[0]?.slug, "home");
	});
});

describe("parseServerPage", () => {
	it("returns null for malformed DTO", () => {
		assert.equal(parseServerPage({ id: "x" }), null);
	});
});

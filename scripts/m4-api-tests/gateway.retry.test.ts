import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newRequestId } from "../../apps/chat-web/src/modules/chat/api/gateway.ts";

describe("requestId", () => {
	it("creates unique ids", () => {
		const a = newRequestId();
		const b = newRequestId();
		assert.match(a, /^req-/);
		assert.notEqual(a, b);
	});
});

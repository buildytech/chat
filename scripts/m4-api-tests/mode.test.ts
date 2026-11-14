import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLiveSessionMode, isMockMode } from "../../apps/chat-web/src/modules/chat/api/mode.ts";

describe("transport mode", () => {
	it("defaults to mock without live=1", () => {
		assert.equal(isMockMode(""), true);
		assert.equal(isLiveSessionMode(""), false);
		assert.equal(isMockMode("?session=abc"), true);
		assert.equal(isMockMode("?mock=1"), true);
	});

	it("does not opt into Session HTTP with live=1", () => {
		assert.equal(isLiveSessionMode("?live=1"), false);
		assert.equal(isMockMode("?live=1"), true);
		assert.equal(isLiveSessionMode("?session=abc&live=1"), false);
	});
});

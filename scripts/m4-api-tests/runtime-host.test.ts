/**
 * ADR 0065: the host the app runs in comes from GET /runtime/v1/status `host` (the desktop host sends it, the web hosts
 * do not), and the session export stamps app.host from it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { DESKTOP_HOST, noteRuntimeHost, runtimeHost } from "../../apps/chat-web/src/lib/runtime-host.ts";

test("ADR 0065: a desktop status host is the desktop; none or anything malformed is the browser", () => {
	noteRuntimeHost(undefined);
	assert.deepEqual(runtimeHost(), { kind: "browser" });
	noteRuntimeHost({ kind: "desktop", version: "0.1.0", os: "windows", arch: "amd64" });
	assert.deepEqual(runtimeHost(), { kind: "desktop", version: "0.1.0", os: "windows", arch: "amd64" });
	noteRuntimeHost({ kind: "desktop", version: "not a version", os: "../x", arch: 7 });
	assert.deepEqual(runtimeHost(), { kind: "desktop" }, "the kind is kept, the bad fields are dropped");
	noteRuntimeHost({ kind: "wordpress" });
	assert.deepEqual(runtimeHost(), { kind: "browser" });
	noteRuntimeHost(null);
	assert.deepEqual(runtimeHost(), { kind: "browser" }, "a failed status read is the browser again");
	assert.ok(DESKTOP_HOST.version.test(DESKTOP_HOST.devVersion) && DESKTOP_HOST.version.test("0.1.0") && DESKTOP_HOST.version.test("1.2.3-rc.1"));
	assert.ok(!DESKTOP_HOST.version.test("v0.1.0") && !DESKTOP_HOST.version.test("0.1"));
});

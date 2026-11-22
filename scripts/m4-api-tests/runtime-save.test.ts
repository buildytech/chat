/**
 * ADR 0065: the desktop host's native save of the ZIP export. The chat's saver is used only while the host advertises
 * capabilities.saveFile and only for an archive the host accepts; it posts the bytes with a plain file name and reads
 * `saved` / `cancelled`; anything else throws, and download.ts then lets the browser download the archive.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { EXPORT_MAX_BYTES, exportName, noteRuntimeSave, runtimeZipSaver } from "../../apps/chat-web/src/modules/chat/browser/runtime-save.ts";

type Call = { url: string; method?: string; type?: string; size: number };

function stubFetch(status: number, answer: unknown, calls: Call[]): () => void {
	const real = globalThis.fetch;
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, method: init?.method, type: new Headers(init?.headers).get("content-type") ?? undefined, size: (init?.body as ArrayBuffer).byteLength });
		return new Response(JSON.stringify(answer), { status, headers: { "content-type": "application/json" } });
	}) as typeof fetch;
	return () => {
		globalThis.fetch = real;
	};
}

test("ADR 0065: the native save is offered only while the host advertises saveFile, for an archive it accepts", () => {
	try {
		noteRuntimeSave(false);
		assert.equal(runtimeZipSaver.available(1000), false);
		noteRuntimeSave(true);
		assert.equal(runtimeZipSaver.available(1000), true);
		assert.equal(runtimeZipSaver.available(0), false);
		assert.equal(runtimeZipSaver.available(EXPORT_MAX_BYTES + 1), false, "too large: the browser downloads it");
	} finally {
		noteRuntimeSave(false);
	}
});

test("ADR 0065: the saver posts the bytes with a plain name and reads saved / cancelled; a failure throws", async () => {
	const calls: Call[] = [];
	const zip = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]);
	let restore = stubFetch(200, { ok: true, saved: true, name: "quiet-rooms-pack.zip" }, calls);
	try {
		assert.equal(await runtimeZipSaver.save(zip, "quiet-rooms-pack.zip"), "saved");
		assert.deepEqual(calls[0], { url: "/runtime/v1/export?name=quiet-rooms-pack.zip", method: "POST", type: "application/zip", size: 22 });
		restore();
		restore = stubFetch(200, { ok: true, saved: false, code: "cancelled" }, calls);
		assert.equal(await runtimeZipSaver.save(zip, "квартира-pack.zip"), "cancelled");
		assert.equal(calls[1]!.url, "/runtime/v1/export?name=page-pack.zip", "a name the host refuses becomes page-pack.zip");
		restore();
		restore = stubFetch(415, { ok: false, code: "export_not_zip" }, calls);
		await assert.rejects(() => runtimeZipSaver.save(zip, "a.zip"), /export_not_zip/);
	} finally {
		restore();
	}
	for (const [name, want] of [["page-pack.zip", "page-pack.zip"], ["../x.zip", "page-pack.zip"], [".hidden.zip", "page-pack.zip"], ["a.exe", "page-pack.zip"], ["shop_1.v2-pack.zip", "shop_1.v2-pack.zip"]]) assert.equal(exportName(name!), want);
});

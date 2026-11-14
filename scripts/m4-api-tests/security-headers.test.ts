/**
 * Security headers (ADR 0043). vercel.json sends the response headers; the page policy (script-src with the hash of the one
 * inline bootstrap script) is a <meta> that SvelteKit writes into every page, the SPA fallback included (the headless smoke checks the built page: the meta is there and nothing is refused). The preview
 * iframes are same-origin about:blank documents and the render bundle is a same-origin module, so 'self' is enough.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const at = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const vercel = JSON.parse(readFileSync(at("vercel.json"), "utf8")) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
const sent = Object.fromEntries(vercel.headers.find((rule) => rule.source === "/(.*)")!.headers.map((h) => [h.key.toLowerCase(), h.value]));

test("every response carries the pinned security headers", () => {
	assert.match(sent["strict-transport-security"]!, /^max-age=(\d{8,}); includeSubDomains; preload$/);
	assert.equal(sent["x-content-type-options"], "nosniff");
	assert.equal(sent["referrer-policy"], "strict-origin-when-cross-origin");
	assert.equal(sent["x-frame-options"], "SAMEORIGIN");
	assert.equal(sent["content-security-policy"], "frame-ancestors 'self'");
	for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) assert.match(sent["permissions-policy"]!, new RegExp(`${feature}=\\(\\)`));
	assert.doesNotMatch(sent["permissions-policy"]!, /clipboard/, "the copy buttons need the clipboard");
});

test("the page policy: scripts only from self plus the hash of the bootstrap script, no inline script, no plugins", () => {
	const config = readFileSync(at("apps/chat-web/svelte.config.js"), "utf8");
	assert.match(config, /mode: 'hash'/);
	assert.match(config, /'script-src': \['self', 'unsafe-eval'\]/, "no unsafe-inline; unsafe-eval only because Ajv compiles the props schemas in the browser");
	assert.match(config, /'object-src': \['none'\]/);
	assert.match(config, /'base-uri': \['self'\]/);
	assert.match(config, /'connect-src': \['self'\]/, "the app talks to its own /runtime only");
});

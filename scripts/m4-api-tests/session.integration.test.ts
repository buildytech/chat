/**
 * Live HTTP integration against context-serve.
 * Requires CONTEXT_SERVE_URL (default http://127.0.0.1:18090).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const base = (process.env.CONTEXT_SERVE_URL ?? "http://127.0.0.1:18090").replace(/\/$/, "");

async function j<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
	const res = await fetch(`${base}${path}`, {
		...init,
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {})
		}
	});
	const body = (await res.json()) as T;
	return { status: res.status, body };
}

function fixturePage(pageId: string, slug: string) {
	const here = dirname(fileURLToPath(import.meta.url));
	const raw = JSON.parse(
		readFileSync(join(here, "../../packages/page-contract/fixtures/north-harbor-kitchen.json"), "utf8")
	) as Record<string, unknown>;
	raw.id = pageId;
	raw.slug = slug;
	raw.title = `M4 ${slug}`;
	return raw;
}

describe("session HTTP integration", () => {
	it("conversation does not create a draft; save_page does; reload restores", async () => {
		const slug = `m4-home-${Date.now().toString(36)}`;
		const caps = await j<{ liveModel: boolean; mode: string }>("/v1/capabilities");
		assert.equal(caps.status, 200);
		assert.equal(caps.body.liveModel, false);

		const created = await j<{ session: { id: string; pageId: string; pageBound: boolean } }>("/v1/sessions", {
			method: "POST",
			body: JSON.stringify({ slugIntent: slug })
		});
		assert.equal(created.status, 201);
		const sessionId = created.body.session.id;
		const pageId = created.body.session.pageId;
		assert.equal(created.body.session.pageBound, false);

		const chat = await j<{ page: unknown; messages: unknown[] }>(`/v1/sessions/${sessionId}/messages`, {
			method: "POST",
			body: JSON.stringify({ content: "What color for the hero?", requestId: `req-chat-${Date.now()}` })
		});
		assert.equal(chat.status, 200);
		assert.equal(chat.body.page, null);

		const pagesBefore = await j(`/v1/pages/${pageId}`);
		assert.equal(pagesBefore.status, 404);

		const save = await j<{
			page: { revision: number; page: { id: string; slug: string } } | null;
			session: { pageBound: boolean };
		}>(`/v1/sessions/${sessionId}/messages`, {
			method: "POST",
			body: JSON.stringify({
				requestId: `req-save-${Date.now()}`,
				tools: [{ name: "save_page", arguments: { page: fixturePage(pageId, slug) } }]
			})
		});
		assert.equal(save.status, 200);
		assert.ok(save.body.page);
		assert.equal(save.body.page?.revision, 1);
		assert.equal(save.body.session.pageBound, true);

		const got = await j<{ session: { pageBound: boolean }; page: { page: { slug: string } } }>(
			`/v1/sessions/${sessionId}`
		);
		assert.equal(got.status, 200);
		assert.equal(got.body.session.pageBound, true);
		assert.equal(got.body.page.page.slug, slug);

		const msgs = await j<{ messages: Array<{ role: string }> }>(`/v1/sessions/${sessionId}/messages`);
		assert.ok(msgs.body.messages.some((m) => m.role === "user"));
		assert.ok(msgs.body.messages.some((m) => m.role === "assistant"));

		const other = await j<{ session: { id: string; pageId: string } }>("/v1/sessions", {
			method: "POST",
			body: JSON.stringify({})
		});
		const otherMsgs = await j<{ messages: unknown[] }>(`/v1/sessions/${other.body.session.id}/messages`);
		assert.equal(otherMsgs.body.messages.length, 0);
		const otherPage = await j(`/v1/pages/${other.body.session.pageId}`);
		assert.equal(otherPage.status, 404);
	});

	it("rejects non-loopback Host", async () => {
		const { request } = await import("node:http");
		const url = new URL(`${base}/v1/capabilities`);
		const status = await new Promise<number>((resolve, reject) => {
			const req = request(
				{ hostname: url.hostname, port: url.port, path: url.pathname, method: "GET", headers: { Host: "evil.example" } },
				(res) => {
					res.resume();
					resolve(res.statusCode ?? 0);
				}
			);
			req.on("error", reject);
			req.end();
		});
		assert.equal(status, 403);
	});
});

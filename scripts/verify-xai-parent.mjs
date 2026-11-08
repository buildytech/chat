#!/usr/bin/env node
/**
 * Standalone parent-box xAI check. Copy this file off-repo.
 * Requires XAI_API_KEY in the environment. Never prints the key, request bodies, or raw errors.
 *
 *   XAI_API_KEY=... node verify-xai-parent.mjs
 */
const BASE = "https://api.x.ai/v1";
const PING_MODEL = "grok-4.20-0309-non-reasoning";

function present(name) {
	return Boolean(process.env[name]?.trim());
}

async function getJson(path) {
	const res = await fetch(`${BASE}${path}`, {
		headers: { Authorization: `Bearer ${process.env.XAI_API_KEY.trim()}`, Accept: "application/json" }
	});
	if (!res.ok) {
		return { ok: false, status: res.status, ids: [] };
	}
	const body = await res.json();
	const ids = Array.isArray(body.data)
		? body.data.map((row) => row.id).filter(Boolean)
		: Array.isArray(body.models)
			? body.models.map((row) => row.id).filter(Boolean)
			: [];
	return { ok: true, status: res.status, ids };
}

async function ping() {
	const res = await fetch(`${BASE}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${process.env.XAI_API_KEY.trim()}`,
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify({
			model: PING_MODEL,
			messages: [{ role: "user", content: "Reply with exactly: BuildY connection OK" }],
			max_tokens: 30,
			temperature: 0
		})
	});
	if (!res.ok) {
		return { ok: false, status: res.status, finish: null, usage: null };
	}
	const body = await res.json();
	return {
		ok: true,
		status: res.status,
		finish: body.choices?.[0]?.finish_reason ?? null,
		usage: body.usage
			? {
					prompt: body.usage.prompt_tokens,
					completion: body.usage.completion_tokens,
					total: body.usage.total_tokens
				}
			: "unknown"
	};
}

async function main() {
	const report = {
		keyPresent: present("XAI_API_KEY"),
		publicLeak: Object.keys(process.env).filter((key) => /^(VITE_|PUBLIC_|NEXT_PUBLIC_)/.test(key) && /KEY|SECRET|TOKEN/i.test(key)),
		models: null,
		languageModels: null,
		imageModels: null,
		ping: null
	};
	if (!report.keyPresent) {
		process.stdout.write(`${JSON.stringify({ ...report, code: "xai_api_key_missing" }, null, 2)}\n`);
		process.exit(2);
	}
	report.models = await getJson("/models");
	report.languageModels = await getJson("/language-models");
	report.imageModels = await getJson("/image-generation-models");
	report.ping = await ping();
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	process.exit(report.ping?.ok ? 0 : 1);
}

main().catch(() => {
	process.stdout.write(`${JSON.stringify({ code: "verify_failed", keyPresent: present("XAI_API_KEY") }, null, 2)}\n`);
	process.exit(1);
});

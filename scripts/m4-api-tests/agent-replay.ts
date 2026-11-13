/** Scripted model for the ADR 0034 replays: chat/completions answers are played back in order, every request is recorded. */
export const MODEL = "grok-4.20-0309-non-reasoning";

export type Scripted = { content?: string | null; calls?: Array<{ name: string; arguments: Record<string, unknown> }> };
export type Seen = { requests: Array<Record<string, unknown>>; toolMessages: Array<{ name: string; content: Record<string, unknown> }> };

export async function withProvider<T>(script: Scripted[], run: (seen: Seen) => Promise<T>): Promise<T> {
	const original = globalThis.fetch;
	const seen: Seen = { requests: [], toolMessages: [] };
	let index = 0;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (!url.includes("/chat/completions")) {
			// Model discovery of the runtime: the one scripted model is listed, no image models.
			const ids = url.includes("/image-generation-models") ? [] : [{ id: MODEL }];
			return new Response(JSON.stringify({ data: ids }), { status: 200, headers: { "content-type": "application/json" } });
		}
		const body = JSON.parse(String(init?.body ?? "{}")) as { messages: Array<{ role: string; name?: string; content?: string }> };
		seen.requests.push(body as Record<string, unknown>);
		seen.toolMessages = body.messages.filter((m) => m.role === "tool").map((m) => ({ name: String(m.name), content: JSON.parse(String(m.content)) as Record<string, unknown> }));
		const step = script[Math.min(index, script.length - 1)]!;
		index += 1;
		const message = {
			role: "assistant",
			content: step.content ?? null,
			...(step.calls?.length ? { tool_calls: step.calls.map((call, i) => ({ id: `call-${index}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } })) } : {})
		};
		return new Response(JSON.stringify({ model: MODEL, choices: [{ message }], usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 } }), { status: 200, headers: { "content-type": "application/json" } });
	}) as typeof fetch;
	try {
		return await run(seen);
	} finally {
		globalThis.fetch = original;
	}
}

export const toolNames = (request: Record<string, unknown>) => (request.tools as Array<{ function: { name: string } }>).map((tool) => tool.function.name);
export const signal = () => new AbortController().signal;


/** Install the render probe from the compiled registry blocks (api/runtime/_render/blocks.mjs, `npm run bundle:runtime`); builds it when missing. */
export async function installBundleProbe(): Promise<() => void> {
	const { existsSync } = await import("node:fs");
	const { spawnSync } = await import("node:child_process");
	const { join } = await import("node:path");
	const { fileURLToPath, pathToFileURL } = await import("node:url");
	const { installRenderProbe } = await import("../../packages/builder-core/src/index.ts");
	const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
	const bundle = join(root, "api", "runtime", "_render", "blocks.mjs");
	if (!existsSync(bundle)) spawnSync(process.execPath, [join(root, "scripts/build-render-bundle.mjs")], { cwd: root, stdio: "pipe" });
	const mod = (await import(pathToFileURL(bundle).href)) as { blocks: Record<string, unknown>; render: (c: unknown, o: { props: Record<string, unknown> }) => { body: string } };
	installRenderProbe((organism, props) => {
		try {
			return { ok: true, html: mod.render(mod.blocks[organism], { props }).body };
		} catch (err) {
			return { ok: false, error: (err as Error).message };
		}
	}, { required: true });
	return () => installRenderProbe(null);
}

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isLoopbackBind, readBasicAuthConfig } from "@buildytech/chat-agent";
import { readServerConfig, runtimeEnv } from "./config.ts";
import { handleRuntimeFetch } from "./http.ts";

// Compiled registry blocks of the render probe (npm run bundle:runtime).
(globalThis as { __buildyRenderLoader?: () => Promise<unknown> }).__buildyRenderLoader = () => import(new URL("../../../api/runtime/_render/blocks.mjs", import.meta.url).href);

const env = runtimeEnv();
const { bind: BIND, port: PORT } = readServerConfig(env);

function logSafe(event: string, extra: Record<string, unknown> = {}): void {
	process.stdout.write(
		`${JSON.stringify({
			event,
			stage: extra.stage ?? "xai-runtime",
			code: extra.code,
			status: extra.status,
			durationMs: extra.durationMs,
			requestId: extra.requestId,
			model: extra.model
		})}\n`
	);
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
	const host = req.headers.host || `${BIND}:${PORT}`;
	const url = `http://${host}${req.url || "/"}`;
	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (typeof value === "string") headers.set(key, value);
		else if (Array.isArray(value)) headers.set(key, value.join(", "));
	}
	const method = req.method || "GET";
	if (method === "GET" || method === "HEAD") {
		return new Request(url, { method, headers });
	}
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	const body = Buffer.concat(chunks);
	return new Request(url, {
		method,
		headers,
		body: body.length ? new Uint8Array(body) : undefined
	});
}

async function fromWebResponse(web: Response, res: ServerResponse): Promise<void> {
	res.statusCode = web.status;
	web.headers.forEach((value, key) => {
		res.setHeader(key, value);
	});
	const buf = Buffer.from(await web.arrayBuffer());
	res.end(buf);
}

const server = createServer(async (req, res) => {
	const started = Date.now();
	const requestId = `xai-${Date.now().toString(36)}`;
	try {
		const webReq = await toWebRequest(req);
		const webRes = await handleRuntimeFetch(webReq, env, { surface: "node" });
		if (webRes.status === 401) {
			logSafe("auth_rejected", { requestId, status: 401, code: "unauthorized", durationMs: Date.now() - started });
		}
		await fromWebResponse(webRes, res);
	} catch (err) {
		res.statusCode = 500;
		res.setHeader("content-type", "application/json");
		res.end(JSON.stringify({ error: { code: "internal", message: "runtime error" }, liveModel: false }));
		logSafe("error", {
			requestId,
			status: 500,
			code: err instanceof Error ? err.name : "error",
			durationMs: Date.now() - started
		});
	}
});

if (!isLoopbackBind(BIND)) {
	const { configured } = readBasicAuthConfig(env);
	if (!configured) {
		logSafe("refusing_shared_bind", { code: "basic_auth_required_before_shared_bind" });
		process.stderr.write(
			"Refusing to bind a non-loopback address without BUILDY_RUNTIME_BASIC_AUTH_USER and BUILDY_RUNTIME_BASIC_AUTH_PASSWORD.\n"
		);
		process.exit(2);
	}
}

server.listen(PORT, BIND, () => {
	logSafe("listen", { code: "listening", stage: `${BIND}:${PORT}` });
});

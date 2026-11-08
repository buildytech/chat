import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mapChatRunRequest, readXaiKeyState, safeErrorMessage } from "@buildytech/builder-core";
import { runXaiCatalogTurn, revalidateProposal } from "./chat-tools.ts";
import { runtimeStatus } from "./status.ts";

const BIND = process.env.BUILDY_RUNTIME_BIND?.trim() || "127.0.0.1";
const PORT = Number(process.env.BUILDY_RUNTIME_PORT || 18100);

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

function unauthorized(res: ServerResponse): void {
	res.statusCode = 401;
	res.setHeader("WWW-Authenticate", 'Basic realm="buildy-xai-runtime"');
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify({ error: { code: "unauthorized", message: "Basic authentication required." } }));
}

function checkAuth(req: IncomingMessage): boolean {
	const user = process.env.BUILDY_RUNTIME_BASIC_AUTH_USER?.trim() ?? "";
	const pass = process.env.BUILDY_RUNTIME_BASIC_AUTH_PASSWORD?.trim() ?? "";
	if (!user || !pass) return BIND === "127.0.0.1" || BIND === "::1";
	const header = req.headers.authorization ?? "";
	if (!header.startsWith("Basic ")) return false;
	try {
		const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
		const idx = decoded.indexOf(":");
		if (idx < 0) return false;
		return decoded.slice(0, idx) === user && decoded.slice(idx + 1) === pass;
	} catch {
		return false;
	}
}

function readJson(req: IncomingMessage): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		let size = 0;
		req.on("data", (c: Buffer) => {
			size += c.length;
			if (size > 256_000) {
				reject(Object.assign(new Error("payload too large"), { code: "too_large" }));
				req.destroy();
				return;
			}
			chunks.push(c);
		});
		req.on("end", () => {
			if (!chunks.length) {
				resolve({});
				return;
			}
			try {
				resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
			} catch {
				reject(Object.assign(new Error("invalid json"), { code: "invalid_json" }));
			}
		});
		req.on("error", reject);
	});
}

function send(res: ServerResponse, status: number, body: unknown): void {
	res.statusCode = status;
	res.setHeader("content-type", "application/json");
	res.setHeader("cache-control", "no-store");
	res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
	const started = Date.now();
	const requestId = `xai-${Date.now().toString(36)}`;
	try {
		if (req.method === "OPTIONS") {
			res.statusCode = 204;
			res.end();
			return;
		}
		if (!checkAuth(req)) {
			unauthorized(res);
			logSafe("auth_rejected", { requestId, status: 401, code: "unauthorized" });
			return;
		}
		const url = new URL(req.url || "/", "http://127.0.0.1");
		if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/health")) {
			send(res, 200, { ok: true, runtime: "xai-grok" });
			return;
		}
		if (req.method === "GET" && (url.pathname === "/v1/status" || url.pathname === "/v1/runtime")) {
			const status = await runtimeStatus();
			send(res, status.key.present ? 200 : 503, status);
			logSafe("status", { requestId, status: status.key.present ? 200 : 503, code: status.code, durationMs: Date.now() - started });
			return;
		}
		if (req.method === "POST" && url.pathname === "/v1/run") {
			const status = await runtimeStatus();
			const body = (await readJson(req)) as Record<string, unknown>;
			const mapped = mapChatRunRequest(body, {
				discoveredChatIds: status.models.listed ? status.models.chatIds : undefined,
				allowUnlistedTrial: !status.ready
			});
			if (!mapped.ok) {
				send(res, 422, {
					ok: false,
					code: mapped.code,
					message: mapped.message,
					requestedId: mapped.requestedId,
					liveModel: false
				});
				logSafe("run_blocked", { requestId, status: 422, code: mapped.code, durationMs: Date.now() - started });
				return;
			}
			if (!status.ready) {
				send(res, 503, {
					error: {
						code: status.code,
						message: "xAI runtime is not ready. This is not a live Grok reply."
					},
					modelId: mapped.request.modelId,
					status,
					liveModel: false
				});
				logSafe("run_blocked", { requestId, status: 503, code: status.code, durationMs: Date.now() - started, model: mapped.request.modelId });
				return;
			}
			const key = readXaiKeyState();
			if (!key.present) {
				send(res, 503, { error: { code: "xai_api_key_missing", message: "XAI_API_KEY is not provisioned here." }, liveModel: false, modelId: mapped.request.modelId });
				return;
			}
			const ac = new AbortController();
			const timer = setTimeout(() => ac.abort(), Math.min(Number(body.abortMs) || 90_000, 90_000));
			try {
				const { proposal, meta } = await runXaiCatalogTurn(
					process.env.XAI_API_KEY!.trim(),
					mapped.request.modelId,
					{
						brief: mapped.request.brief,
						scenarioId: mapped.request.scenarioId,
						screenId: mapped.request.screenId,
						expectedRevision: mapped.request.expectedRevision,
						pageId: mapped.request.pageId
					},
					ac.signal
				);
				const checked = revalidateProposal(proposal);
				send(res, checked.ok ? 200 : 422, {
					...checked,
					liveModel: false,
					liveXai: checked.ok && meta.toolCallingWorked,
					toolCallingProven: meta.toolCallingWorked,
					runtime: "xai-grok",
					modelId: meta.modelId,
					requestedModelId: mapped.request.modelId,
					path: meta.path,
					usage: meta.usage
				});
				logSafe("run", {
					requestId,
					status: checked.ok ? 200 : 422,
					code: checked.ok ? "ok" : checked.code,
					durationMs: Date.now() - started,
					model: meta.modelId
				});
			} finally {
				clearTimeout(timer);
			}
			return;
		}
		send(res, 404, { error: { code: "not_found", message: "Unknown runtime path." } });
	} catch (err) {
		const safe = safeErrorMessage(err);
		send(res, 500, { error: safe, liveModel: false });
		logSafe("error", { requestId, status: 500, code: safe.code, durationMs: Date.now() - started });
	}
});

if (BIND !== "127.0.0.1" && BIND !== "::1") {
	const user = process.env.BUILDY_RUNTIME_BASIC_AUTH_USER?.trim();
	const pass = process.env.BUILDY_RUNTIME_BASIC_AUTH_PASSWORD?.trim();
	if (!user || !pass) {
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

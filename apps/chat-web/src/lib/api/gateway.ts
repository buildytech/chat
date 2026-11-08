import { apiBase } from "./mode.ts";

export type GatewayError = {
	status: number;
	code: string;
	path: string;
	message: string;
};

export class GatewayRequestError extends Error {
	readonly status: number;
	readonly code: string;
	readonly path: string;
	constructor(err: GatewayError) {
		super(err.message);
		this.name = "GatewayRequestError";
		this.status = err.status;
		this.code = err.code;
		this.path = err.path;
	}
}

export type ServerSession = {
	id: string;
	pageId: string;
	slugIntent?: string;
	title: string;
	pageBound: boolean;
	pageRevision: number | null;
	createdAt: string;
	updatedAt: string;
};

export type ServerMessage = {
	id: string;
	sessionId: string;
	seq: number;
	role: "user" | "assistant" | "tool" | "system";
	content: string;
	runId?: string;
	createdAt: string;
};

export type ServerRun = {
	id: string;
	sessionId: string;
	requestId?: string;
	status: "pending" | "completed" | "failed";
	requestHash?: string;
	result?: unknown;
	errorCode?: string;
	errorMessage?: string;
	createdAt: string;
	updatedAt: string;
};

export type ServerCapabilities = {
	runtime: string;
	mode: string;
	liveModel: boolean;
	live?: { requested?: boolean; provider?: string; model?: string };
	tools: string[];
	features?: Record<string, unknown>;
	note?: string;
};

export type TurnBody = {
	content?: string;
	requestId?: string;
	tools?: Array<{ name: string; arguments?: Record<string, unknown> }>;
};

export type TurnResponse = {
	run: ServerRun;
	messages: ServerMessage[];
	session: ServerSession;
	page: { page: unknown; revision: number } | null;
};

async function parseError(res: Response): Promise<GatewayRequestError> {
	let code = "http_error";
	let path = "$";
	let message = res.statusText || "request failed";
	try {
		const body = (await res.json()) as { error?: { code?: string; path?: string; message?: string } };
		if (body?.error) {
			code = body.error.code ?? code;
			path = body.error.path ?? path;
			message = body.error.message ?? message;
		}
	} catch {
		/* keep defaults */
	}
	return new GatewayRequestError({ status: res.status, code, path, message });
}

export async function gatewayFetch<T>(
	path: string,
	init: RequestInit & { signal?: AbortSignal } = {}
): Promise<T> {
	const headers = new Headers(init.headers);
	if (init.body && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}
	const res = await fetch(`${apiBase()}${path}`, { ...init, headers });
	if (!res.ok) throw await parseError(res);
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

export function listSessionsApi(signal?: AbortSignal) {
	return gatewayFetch<{ sessions: ServerSession[] }>("/v1/sessions", { signal });
}

export function createSessionApi(body: { slugIntent?: string; title?: string } = {}, signal?: AbortSignal) {
	return gatewayFetch<{ session: ServerSession }>("/v1/sessions", {
		method: "POST",
		body: JSON.stringify(body),
		signal
	});
}

export function getSessionApi(id: string, signal?: AbortSignal) {
	return gatewayFetch<{ session: ServerSession; page?: { page: unknown; revision: number } }>(
		`/v1/sessions/${encodeURIComponent(id)}`,
		{ signal }
	);
}

export function listMessagesApi(id: string, signal?: AbortSignal) {
	return gatewayFetch<{ messages: ServerMessage[] }>(
		`/v1/sessions/${encodeURIComponent(id)}/messages`,
		{ signal }
	);
}

export function postMessageApi(id: string, body: TurnBody, signal?: AbortSignal) {
	const requestId = body.requestId ?? newRequestId();
	return gatewayFetch<TurnResponse>(`/v1/sessions/${encodeURIComponent(id)}/messages`, {
		method: "POST",
		headers: { "Idempotency-Key": requestId },
		body: JSON.stringify({ ...body, requestId }),
		signal
	});
}

export function recoverRunApi(sessionId: string, runId: string, signal?: AbortSignal) {
	return gatewayFetch<TurnResponse>(
		`/v1/sessions/${encodeURIComponent(sessionId)}/runs/${encodeURIComponent(runId)}/recover`,
		{ method: "POST", body: "{}", signal }
	);
}

export function getCapabilitiesApi(signal?: AbortSignal) {
	return gatewayFetch<ServerCapabilities>("/v1/capabilities", { signal });
}

export function newRequestId(): string {
	return `req-${crypto.randomUUID()}`;
}

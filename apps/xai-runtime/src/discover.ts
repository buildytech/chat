import {
	CANDIDATE_CHAT_MODEL,
	XAI_BASE_URL,
	classifyDiscoveredModels,
	readEnv,
	readXaiKeyState,
	redactValue,
	type EnvMap
} from "@buildytech/builder-core";

export type DiscoveredModels = {
	ok: boolean;
	code: string;
	ids: string[];
	chatIds: string[];
	imageIds: string[];
	candidate: string | null;
	languageModelCount: number | null;
	imageModelCount: number | null;
	toolCallingProven: false;
};

function idsFromPayload(payload: unknown): string[] {
	if (!payload || typeof payload !== "object") return [];
	const rec = payload as Record<string, unknown>;
	const rows = Array.isArray(rec.data) ? rec.data : Array.isArray(rec.models) ? rec.models : [];
	return rows
		.map((row) => {
			if (typeof row === "string") return row;
			if (row && typeof row === "object") {
				const item = row as { id?: unknown; name?: unknown };
				return String(item.id || item.name || "");
			}
			return "";
		})
		.filter(Boolean);
}

async function getJson(path: string, apiKey: string, signal: AbortSignal): Promise<{ status: number; payload: unknown }> {
	const res = await fetch(`${XAI_BASE_URL}${path}`, {
		method: "GET",
		headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
		signal
	});
	let payload: unknown = null;
	try {
		payload = await res.json();
	} catch {
		payload = null;
	}
	void redactValue({ authorization: "Bearer [redacted]" });
	return { status: res.status, payload };
}

export async function discoverAccountModels(
	env: EnvMap = readEnv(),
	signal?: AbortSignal
): Promise<DiscoveredModels> {
	const key = readXaiKeyState(env);
	if (!key.present) {
		return {
			ok: false,
			code: "xai_api_key_missing",
			ids: [],
			chatIds: [],
			imageIds: [],
			candidate: null,
			languageModelCount: null,
			imageModelCount: null,
			toolCallingProven: false
		};
	}
	const apiKey = env.XAI_API_KEY!.trim();
	const ac = signal ?? AbortSignal.timeout(15_000);
	try {
		const [models, language, images] = await Promise.all([
			getJson("/models", apiKey, ac),
			getJson("/language-models", apiKey, ac),
			getJson("/image-generation-models", apiKey, ac)
		]);
		if (models.status !== 200 && language.status !== 200) {
			return {
				ok: false,
				code: "xai_models_list_failed",
				ids: [],
				chatIds: [],
				imageIds: [],
				candidate: null,
				languageModelCount: null,
				imageModelCount: null,
				toolCallingProven: false
			};
		}
		const ids = [...new Set([...idsFromPayload(models.payload), ...idsFromPayload(language.payload)])];
		const classified = classifyDiscoveredModels(ids);
		const imageFromEndpoint = idsFromPayload(images.payload);
		const imageIds = [...new Set([...classified.imageIds, ...imageFromEndpoint])];
		const chatIds = classified.chatIds.filter((id) => !imageIds.includes(id));
		return {
			ok: chatIds.length > 0,
			code: chatIds.length ? "xai_models_discovered" : "xai_no_chat_models",
			ids,
			chatIds,
			imageIds,
			candidate: chatIds.includes(CANDIDATE_CHAT_MODEL) ? CANDIDATE_CHAT_MODEL : (chatIds[0] ?? null),
			languageModelCount: language.status === 200 ? idsFromPayload(language.payload).length : null,
			imageModelCount: images.status === 200 ? imageFromEndpoint.length : null,
			toolCallingProven: false
		};
	} catch {
		return {
			ok: false,
			code: "xai_models_list_unavailable",
			ids: [],
			chatIds: [],
			imageIds: [],
			candidate: null,
			languageModelCount: null,
			imageModelCount: null,
			toolCallingProven: false
		};
	}
}

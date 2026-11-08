import {
	CANDIDATE_CHAT_MODEL,
	PARENT_VERIFIED_CHAT_IDS,
	PARENT_VERIFIED_IMAGE_IDS,
	RUNTIME_AUTH_ENV,
	XAI_RUNTIME_NOTES,
	XAI_SECRET_ENV,
	hasPublicSecretLeak,
	readXaiKeyState
} from "@buildytech/builder-core";
import { discoverAccountModels } from "./discover.ts";

export type XaiRuntimeStatus = {
	runtime: "xai-grok";
	ready: boolean;
	liveModel: false;
	code: string;
	key: { present: boolean; source: string | null };
	auth: { basicRequired: boolean; loopbackOnly: boolean };
	models: {
		listed: boolean;
		chatIds: string[];
		imageIds: string[];
		candidate: string | null;
		toolCallingProven: false;
		parentVerifiedChat: readonly string[];
		parentVerifiedImage: readonly string[];
	};
	sdk: { openaiProvider: boolean; ai: boolean };
	notes: typeof XAI_RUNTIME_NOTES;
	envNames: { xai: readonly string[]; basicAuth: readonly string[] };
	publicSecretLeak: string[];
};

async function sdkPresent(): Promise<{ openaiProvider: boolean; ai: boolean }> {
	let openaiProvider = false;
	let ai = false;
	try {
		await import("@ai-sdk/openai");
		openaiProvider = true;
	} catch {
		openaiProvider = false;
	}
	try {
		await import("ai");
		ai = true;
	} catch {
		ai = false;
	}
	return { openaiProvider, ai };
}

export async function runtimeStatus(env: NodeJS.ProcessEnv = process.env): Promise<XaiRuntimeStatus> {
	const leaks = hasPublicSecretLeak(env);
	const key = readXaiKeyState(env);
	const user = env.BUILDY_RUNTIME_BASIC_AUTH_USER?.trim() ?? "";
	const pass = env.BUILDY_RUNTIME_BASIC_AUTH_PASSWORD?.trim() ?? "";
	const basicRequired = Boolean(user && pass);
	const bind = env.BUILDY_RUNTIME_BIND?.trim() || "127.0.0.1";
	const loopbackOnly = bind === "127.0.0.1" || bind === "::1";
	const sdk = await sdkPresent();

	let listed = false;
	let chatIds: string[] = [];
	let imageIds: string[] = [];
	let candidate: string | null = null;
	let discoverCode = key.present ? "xai_models_list_pending" : "xai_api_key_missing";

	if (key.present) {
		const discovered = await discoverAccountModels(env);
		listed = discovered.ok || discovered.chatIds.length > 0 || discovered.ids.length > 0;
		chatIds = discovered.chatIds;
		imageIds = discovered.imageIds;
		candidate = discovered.candidate;
		discoverCode = discovered.code;
	}

	let code = "xai_api_key_missing";
	if (leaks.length) code = "public_secret_forbidden";
	else if (!key.present) code = "xai_api_key_missing";
	else if (!loopbackOnly && !basicRequired) code = "basic_auth_required_before_shared_bind";
	else if (!listed) code = discoverCode;
	else if (!candidate) code = "xai_no_chat_models";
	else code = "xai_runtime_ready";

	const ready = code === "xai_runtime_ready";

	return {
		runtime: "xai-grok",
		ready,
		liveModel: false,
		code,
		key: { present: key.present, source: key.source },
		auth: { basicRequired, loopbackOnly },
		models: {
			listed,
			chatIds,
			imageIds,
			candidate: candidate ?? (key.present ? null : CANDIDATE_CHAT_MODEL),
			toolCallingProven: false,
			parentVerifiedChat: PARENT_VERIFIED_CHAT_IDS,
			parentVerifiedImage: PARENT_VERIFIED_IMAGE_IDS
		},
		sdk,
		notes: XAI_RUNTIME_NOTES,
		envNames: { xai: XAI_SECRET_ENV, basicAuth: RUNTIME_AUTH_ENV },
		publicSecretLeak: leaks
	};
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runtimeStatus().then((status) => {
		process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
	});
}

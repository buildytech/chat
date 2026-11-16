/** Public data only: no transport, credentials, prompts or runtime imports. */
import { XAI_MANIFEST, XAI_MANIFEST_V1 } from "./xai.ts";
export { XAI_MANIFEST, XAI_MODELS } from "./xai.ts";
export const PROVIDER_MANIFESTS = immutableData([XAI_MANIFEST, XAI_MANIFEST_V1] as const);
export function providerManifest(id: string, version?: number) { return PROVIDER_MANIFESTS.filter((manifest) => manifest.id === id && (version === undefined || manifest.version === version)).sort((a, b) => b.version - a.version)[0] ?? null; }
export function manifestModelStatus(providerId: string, modelId: string, version?: number) {
	const model = providerManifest(providerId, version)?.models.find((model) => model.id === modelId);
	if (!model) return { status: "unknown", code: "unknown_chat_model" } as const;
	if ("toolLoop" in model && model.toolLoop === "unavailable") return { status: "disabled", code: model.unavailableCode } as const;
	return { status: "enabled", code: null } as const;
}

export function immutableData<T>(value: T): T {
	if (value !== null && typeof value === "object") {
		for (const child of Object.values(value)) immutableData(child);
		Object.freeze(value);
	}
	return value;
}

import { providerManifest, manifestModelStatus } from "@buildytech/agent-manifests";
export function xaiCapabilities(modelId: string, version?: number) {
	const manifest = providerManifest("xai", version);
	if (!manifest) return null;
	const model = manifestModelStatus("xai", modelId, manifest.version);
	const { models: _models, defaultModelId: _default, id, ...capabilities } = manifest;
	return { ...capabilities, provider: id, modelId, toolLoop: model.status, unavailableCode: model.code };
}

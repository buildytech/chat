import { immutableData, providerManifest } from "@buildytech/agent-manifests";
import definitions from "./builtins.v1.json" with { type: "json" };
import { compileScenario, parseScenarioRef, type ScenarioRef } from "./compile.ts";
import { AGENT_MODES, type AgentMode } from "../agent/agent-tools.ts";

immutableData(definitions);
const profiles = definitions.profiles;
const identities = new Set<string>();
for (const profile of profiles) {
	const key = `${profile.id}@${profile.version}`;
	if (identities.has(key)) throw new Error(`Duplicate scenario: ${key}`);
	identities.add(key);
	const manifest = providerManifest(profile.provider, profile.providerVersion);
	const modelId = "id" in profile.model && typeof profile.model.id === "string" ? profile.model.id : manifest?.defaultModelId;
	if (!modelId || !compileScenario(profile, modelId).ok) throw new Error(`Invalid built-in scenario: ${key}`);
}
for (const mode of AGENT_MODES) {
	const ref = parseScenarioRef(definitions.defaults[mode]);
	if (!ref || !profiles.some((profile) => profile.id === ref.id && profile.version === ref.version && profile.mode === mode)) throw new Error(`Invalid default scenario for ${mode}`);
}
const cache = new Map<string, ReturnType<typeof compileScenario>>();

export function scenarioProfiles() { return profiles; }

/** Live resolution accepts registered references only, never a browser-supplied profile body. */
export function resolveScenario(mode: AgentMode, modelId: string, ref: ScenarioRef = definitions.defaults[mode]) {
	const profile = profiles.find((profile) => profile.id === ref.id && profile.version === ref.version && profile.mode === mode);
	if (!profile) return { ok: false, issues: [{ path: "/scenario", code: "unknown_scenario_version_or_mode" }] } as const;
	const key = `${profile.id}@${profile.version}:${modelId}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const result = compileScenario(profile, modelId);
	if (result.ok) cache.set(key, result);
	return result;
}

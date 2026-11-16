import { ALLOWED_TOOLS } from "@buildytech/builder-core";
import Ajv2020 from "ajv/dist/2020.js";
import { immutableData, providerManifest, manifestModelStatus } from "@buildytech/agent-manifests";
import schema from "./profile.schema.json" with { type: "json" };
import { AGENT_BUDGET } from "../agent/budget.ts";
import { AGENT_TOOLS_VERSION, agentTools, agentToolChoice, type AgentMode } from "../agent/agent-tools.ts";
import { SYSTEM_ASK, SYSTEM_BUILD, userPrompt, nudgeText } from "../agent/prompts.ts";
import { fnv1a64 } from "../identity.ts";

export type ExecutionBudget = { maxSteps: number; maxRequests: number; maxToolCalls: number; maxWriteAttempts: number; maxTokens: number };
export type ScenarioRef = { id: string; version: number };
export type ScenarioProfile = ScenarioRef & {
	model: { selection: "author" } | { id: string };
	format: "buildy-agent-scenario"; mode: AgentMode; provider: string; providerVersion: number; prompt: string; context: string; nudge: string;
	toolSet: { ref: string; include?: string[] }; execution: string; limits: Partial<ExecutionBudget>;
};
const ajv = new Ajv2020({ strict: true, allErrors: true });
const validate = ajv.compile<ScenarioProfile>(schema);
const validateRef = ajv.compile<ScenarioRef>({ type: "object", additionalProperties: false, required: ["id", "version"], properties: { id: schema.properties.id, version: schema.properties.version } });
export function parseScenarioRef(raw: unknown): ScenarioRef | null { return validateRef(raw) ? immutableData(structuredClone(raw)) : null; }
const prompts: Record<string, string> = { "page.ask@1": SYSTEM_ASK, "page.build@1": SYSTEM_BUILD };

function identity(value: unknown): string {
	const json = JSON.stringify(value, (_key, node: unknown) => node !== null && typeof node === "object" && !Array.isArray(node) ? Object.fromEntries(Object.entries(node).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : node);
	return `scenario-v1-${fnv1a64(json)}`;
}

/** Compile drafts for inspection; only the registered resolver is used for live execution. */
export function compileScenario(raw: unknown, modelId: string) {
	if (!validate(raw)) return { ok: false, issues: (validate.errors ?? []).map((error) => ({ path: error.instancePath, code: error.keyword })) } as const;
	const profile = structuredClone(raw);
	const issues: Array<{ path: string; code: string }> = [];
	const reject = (path: string, code: string) => { issues.push({ path, code }); };
	const manifest = providerManifest(profile.provider, profile.providerVersion);
	if (!manifest) reject("/provider", "unknown_provider_version");
	if (manifest && !manifest.toolChoices.some((choice) => choice === agentToolChoice(profile.mode))) reject("/provider", "unsupported_tool_choice");
	if ("id" in profile.model && profile.model.id !== modelId) reject("/model/id", "model_binding_mismatch");
	if (manifestModelStatus(profile.provider, modelId, profile.providerVersion).status !== "enabled") reject("/modelId", "model_unavailable");
	if (!prompts[profile.prompt] || profile.prompt !== `page.${profile.mode}@1`) reject("/prompt", "incompatible_prompt");
	if (profile.context !== "page.context@1") reject("/context", "unknown_context");
	if (profile.nudge !== "page.nudge@1") reject("/nudge", "unknown_nudge");
	if (profile.execution !== "page-loop@1") reject("/execution", "unknown_execution");
	if (profile.toolSet.ref !== AGENT_TOOLS_VERSION) reject("/toolSet/ref", "unknown_tool_version");
	const available = agentTools(profile.mode);
	if (profile.toolSet.include?.some((name) => !available.some((tool) => tool.name === name))) reject("/toolSet/include", "unknown_tool");
	const tools = profile.toolSet.include ? available.filter((tool) => profile.toolSet.include?.includes(tool.name)) : available;
	if (tools.length !== available.length) reject("/toolSet/include", "incompatible_prompt_tools");
	if (tools.some((tool) => !ALLOWED_TOOLS.some((name) => name === tool.name))) reject("/toolSet/include", "missing_handler");
	if (!tools.some((tool) => tool.name === "write_page")) reject("/toolSet/include", "write_required");
	const { toolPageSize: _pageSize, ...ceilings } = AGENT_BUDGET;
	const overrides = new Map(Object.entries(profile.limits));
	for (const [key, ceiling] of Object.entries(ceilings)) {
		const value = overrides.get(key);
		if (value !== undefined && value > ceiling) reject(`/limits/${key}`, "budget_ceiling");
	}
	if (issues.length || !manifest) return { ok: false, issues } as const;
	const budget: ExecutionBudget = { ...ceilings, ...profile.limits };
	const fingerprint = identity({ profile, modelId, manifest, prompt: prompts[profile.prompt], tools, budget, toolChoice: agentToolChoice(profile.mode) });
	return { ok: true, scenario: immutableData({ profile, modelId, manifestVersion: manifest.version, systemPrompt: prompts[profile.prompt]!, context: userPrompt, nudge: nudgeText, tools, budget, toolChoice: agentToolChoice(profile.mode), fingerprint }) } as const;
}
export type CompiledScenario = Extract<ReturnType<typeof compileScenario>, { ok: true }>["scenario"];

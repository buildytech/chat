/** The chat side of BuildY (A-06): agent turn and tools, model resolution, usage, xAI environment, runtime protection. */
export * from "./agent/agent-tools.ts";
export * from "./agent/blocks.ts";
export * from "./agent/catalog-tools.ts";
export * from "./agent/turn.ts";
export * from "./models.ts";
export * from "./proposal-base.ts";
export { chatCacheKey } from "./identity.ts";
export * from "./usage.ts";
export { TICKS_PER_USD, usdToTicks } from "./cost.ts";
export { OPENROUTER_MODELS, appCandidate, appModelIds } from "@buildytech/agent-manifests";
export { APPROVED_ID_PATTERN, APPROVED_MAX_IDS, IMAGE_MODELS, MEDIA_SLOT_CONCURRENCY, MODEL_KINDS, OPENROUTER_MEDIA_ENABLED, PROVIDER_IDS, PROVIDER_ROLES, PROVIDER_ROLE_SUPPORT, XAI_KEY_MAX, isProviderId, isProviderLimit, openRouterModel, type ModelKind, type ProviderId, type ProviderRole } from "@buildytech/agent-manifests";
export * from "./xai-env.ts";
export * from "./protect.ts";
export * from "./redact.ts";
export * from "./env-map.ts";
export { contractFingerprint } from "./fingerprint.ts";
export { MACRO_RULE, SYSTEM_ASK, SYSTEM_BUILD, nudgeText, systemText, todayIn, userPrompt } from "./agent/prompts.ts";
export { runAgentLoop } from "./agent/loop.ts";
export { turnMeta, type AgentProvider, type ProviderRequest, type ProviderStep, type AgentMessage, type AgentCall, type LiveTurnMeta } from "./agent/provider.ts";
export { compileScenario, parseScenarioRef, type ScenarioProfile, type ScenarioRef, type CompiledScenario } from "./scenarios/compile.ts";
export { resolveScenario, scenarioProfiles } from "./scenarios/registry.ts";
export { POLICY_VERSION, MODEL_CATALOG_VERSION, TRIAL_POLICY_VERSION } from "./policy.ts";

export type { RunTrace } from "./agent/run-trace.ts";
export { buildSummaryFacts, type BuildSummaryFacts } from "./agent/build-summary.ts";

export { startAttempt, endAttempt, usageOfAttempts, readRunAttempts, type RunAttempt, type RunAttempts } from "./run-attempt.ts";

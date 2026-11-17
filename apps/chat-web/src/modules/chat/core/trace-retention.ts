import { aggregateStepUsage, readProviderUsage, unknownUsage, readRunAttempts, type RunUsage } from "@buildytech/chat-agent";
import type { Project } from "../../../lib/project/types.ts";
import { docOfProject } from "../../../lib/project/doc.ts";
import { STORAGE_KEYS, type StorageFootprint } from "../../../lib/browser/storage-v1.ts";

export const TRACE_RETENTION_POLICY = { version: 1, maxDetailedTraces: 20, maxTraceJsonUtf8Bytes: 1_048_576, originEstimatedUtf16SoftLimitBytes: 4_194_304 } as const;
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function size(value: unknown) { const json = JSON.stringify(value) ?? "null"; return { jsonUtf8Bytes: new TextEncoder().encode(json).length, estimatedUtf16Bytes: json.length * 2 }; }
function traces(project: Project): Record<string, unknown> { return project.ext["agent-trace"] ?? {}; }
function knownTrace(value: unknown): value is Record<string, unknown> { return record(value) && value.format === "run-trace/1" && Array.isArray(value.steps) && Array.isArray(value.toolResults); }
function codes(trace: Record<string, unknown>) {
	if (record(trace.summary) && Array.isArray(trace.summary.gateCodes)) return trace.summary.gateCodes.filter((code): code is string => typeof code === "string");
	const results = Array.isArray(trace.toolResults) ? trace.toolResults : [];
	return [...new Set(results.filter(record).flatMap((result) => record(result.gate) && Array.isArray(result.gate.codes) ? result.gate.codes.filter((code): code is string => typeof code === "string") : []))].sort();
}
function traceUsage(trace: Record<string, unknown>): RunUsage {
	const steps = Array.isArray(trace.steps) ? trace.steps : [];
	return steps.length ? aggregateStepUsage(steps.map((step) => record(step) && record(step.usage) ? readProviderUsage({ prompt_tokens: step.usage.prompt, completion_tokens: step.usage.completion, prompt_tokens_details: { cached_tokens: step.usage.cached }, completion_tokens_details: { reasoning_tokens: step.usage.reasoning }, cost_in_usd_ticks: step.usage.cost_in_usd_ticks }) : null), { requests: steps.length }) : unknownUsage("error", 0);
}
function ticks(usage: RunUsage) { return usage.cost.available && usage.cost.kind === "billed" ? usage.cost.ticks : "unknown"; }

/** Keep forensic totals before discarding any details; unknown extensions are never reinterpreted. */
function summarize(project: Project, id: string, trace: Record<string, unknown>, reason: string, at: string) {
	const attempts = readRunAttempts(project.ext["agent-runs"]);
	const entry = Object.entries(attempts ?? {}).find(([, attempt]) => attempt.runId === id);
	const usage = entry?.[1].usage ?? traceUsage(trace);
	const summary = { fingerprint: typeof trace.fingerprint === "string" ? trace.fingerprint : null, gateCodes: codes(trace), cost_in_usd_ticks: ticks(usage), ...(entry ? { attemptId: entry[0] } : { usage }), originalSteps: Array.isArray(trace.steps) ? trace.steps.length : 0 };
	const captured = record(trace.storage) ? trace.storage : size(trace);
	const retained = { ...trace, prefix: {}, steps: [], toolResults: [], summary, storage: captured, retention: { state: "summary", reason, removedAt: at, policyVersion: TRACE_RETENTION_POLICY.version } };
	const ext: Record<string, Readonly<Record<string, unknown>>> = { ...project.ext, "agent-trace": { ...traces(project), [id]: retained } };
	const updatedAttempt = entry ? { ...entry[1], fingerprint: summary.fingerprint, gateCodes: summary.gateCodes, cost_in_usd_ticks: summary.cost_in_usd_ticks, traceRetention: retained.retention, traceStorage: captured } : null;
	if (entry && attempts && updatedAttempt) ext["agent-runs"] = { ...attempts, [entry[0]]: updatedAttempt };
	const before = size(trace), after = size(retained);
	const oldAttempt = size(entry?.[1] ?? null), newAttempt = size(updatedAttempt);
	return { project: { ...project, ext }, traceUtf8Delta: after.jsonUtf8Bytes - before.jsonUtf8Bytes, originUtf16Delta: after.estimatedUtf16Bytes - before.estimatedUtf16Bytes + newAttempt.estimatedUtf16Bytes - oldAttempt.estimatedUtf16Bytes };
}
function measure(projects: readonly Project[], footprint: StorageFootprint) {
	const docs = projects.map(docOfProject);
	const sessions = size(docs);
	const traceBytes = projects.reduce((total, project) => total + Object.values(traces(project)).reduce<number>((sum, trace) => sum + size(trace).jsonUtf8Bytes, 0), 0);
	return { sessionsJsonUtf8Bytes: sessions.jsonUtf8Bytes, traceJsonUtf8Bytes: traceBytes, originEstimatedUtf16Bytes: footprint.otherEstimatedUtf16Bytes === null ? null : footprint.otherEstimatedUtf16Bytes + sessions.estimatedUtf16Bytes + STORAGE_KEYS.sessions.length * 2 };
}
function annotate(projects: readonly Project[], footprint: StorageFootprint) {
	const totals = measure(projects, footprint);
	return projects.map((project) => {
		const { "agent-storage": _previous, ...ext } = project.ext;
		if (!ext["agent-trace"] && !ext["agent-runs"]) return project;
		const projectSize = size(docOfProject({ ...project, ext }));
		return { ...project, ext: { ...ext, "agent-storage": { format: "agent-storage/1", policyVersion: TRACE_RETENTION_POLICY.version, basis: "project-excludes-own-metrics; origin-before-current-metrics", project: projectSize, ...totals, budgetExceeded: totals.traceJsonUtf8Bytes > TRACE_RETENTION_POLICY.maxTraceJsonUtf8Bytes || (totals.originEstimatedUtf16Bytes !== null && totals.originEstimatedUtf16Bytes > TRACE_RETENTION_POLICY.originEstimatedUtf16SoftLimitBytes), coverage: footprint.coverage } } };
	});
}

function captureMetrics(input: readonly Project[], footprint: StorageFootprint, at: string): Project[] {
	const totals = measure(input, footprint);
	return input.map((project) => {
		const attempts = readRunAttempts(project.ext["agent-runs"]);
		if (!attempts) return project;
		const projectSize = size(docOfProject(project));
		const updated = Object.fromEntries(Object.entries(attempts).map(([id, attempt]) => {
			const trace = attempt.runId ? traces(project)[attempt.runId] : undefined;
			if (attempt.status === "running" || attempt.storage || !knownTrace(trace)) return [id, attempt];
			return [id, { ...attempt, fingerprint: typeof trace.fingerprint === "string" ? trace.fingerprint : null, ...(typeof trace.providerVersion === "number" ? { providerVersion: trace.providerVersion } : {}), ...(typeof trace.catalogDigest === "string" ? { catalogDigest: trace.catalogDigest } : {}), gateCodes: codes(trace), cost_in_usd_ticks: ticks(attempt.usage), storage: { format: "run-storage/1", capturedAt: at, basis: "before-current-save-metrics", trace: size(trace), project: projectSize, ...totals, coverage: footprint.coverage } }];
		}));
		return { ...project, ext: { ...project.ext, "agent-runs": updated } };
	});
}

/** Across all projects. Only known trace details are pruned; pages/messages/history/foreign data survive. */
export function retainTraces(input: readonly Project[], footprint: StorageFootprint, at = new Date().toISOString()): readonly Project[] {
	const projects = captureMetrics(input, footprint, at);
	const candidates = projects.flatMap((project, index) => Object.entries(traces(project)).flatMap(([id, trace]) => knownTrace(trace) && trace.stopReason !== "running" && !(record(trace.retention) && trace.retention.state === "summary") ? [{ index, id, trace, at: typeof trace.startedAt === "string" ? trace.startedAt : "" }] : [])).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
	let remaining = candidates.length;
	const totals = measure(projects, footprint);
	for (const candidate of candidates) {
		const reason = footprint.aggressive ? "quota_retry" : remaining > TRACE_RETENTION_POLICY.maxDetailedTraces ? "count_limit" : totals.traceJsonUtf8Bytes > TRACE_RETENTION_POLICY.maxTraceJsonUtf8Bytes ? "trace_byte_budget" : totals.originEstimatedUtf16Bytes !== null && totals.originEstimatedUtf16Bytes > TRACE_RETENTION_POLICY.originEstimatedUtf16SoftLimitBytes ? "origin_byte_budget" : null;
		if (!reason) break;
		const compact = summarize(projects[candidate.index]!, candidate.id, candidate.trace, reason, at);
		projects[candidate.index] = compact.project;
		totals.traceJsonUtf8Bytes += compact.traceUtf8Delta;
		if (totals.originEstimatedUtf16Bytes !== null) totals.originEstimatedUtf16Bytes += compact.originUtf16Delta;
		remaining -= 1;
	}
	return annotate(projects, footprint);
}

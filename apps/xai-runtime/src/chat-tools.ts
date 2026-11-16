/**
 * The agent turn on xAI chat completions (ADR 0034). One loop for Ask and Build: the model reads the page document and the
 * registry (get_page, get_block, search_catalog) and writes with one tool, write_page (a whole page or an RFC 6902 patch).
 * The host gates every write (page-spec/v2 schema, registry props schema, selection scope,
 * collection) and answers with the diff or a list of { path, code, expected, got }; the model fixes its own document. The
 * loop stops after two identical error lists. There is no local repair, no operation taxonomy, no phrase recognition.
 */
import { RUN_BUDGET, itemInfo, renderProblems } from "@buildytech/builder-core";
import { DEFAULT_XAI_BASE_URL, agentOpenAiTools, agentToolChoice, agentReply, aggregateStepUsage, assertNoFallback, executeCatalogTool, readProviderUsage, rejectedWrite, runWriteTool, safeErrorMessage, unknownUsage, type AgentFailure, type AgentReply, type PageProposal, type RunUsage, type StepUsage, type TurnContext } from "@buildytech/chat-agent";
import { SYSTEM_ASK, SYSTEM_BUILD, nudgeText, userPrompt } from "@buildytech/chat-agent";
import type { PageV2 } from "@buildytech/page-contract";
import { installPropsGate } from "@buildytech/builder-core/props-gate";

// Program-level props gate (Ajv 2020 over the pinned registry props schemas); fail-closed until installed.
installPropsGate();

type ChatMessage = {
	role: "system" | "user" | "assistant" | "tool";
	content?: string | null;
	tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
	tool_call_id?: string;
	name?: string;
};

function silentFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	return fetch(input, init);
}


type LiveTurnMeta = {
	runId: string;
	path: "chat-completions";
	modelId: string;
	requestedModelId: string;
	toolCallingWorked: boolean;
	steps: number;
	toolsCalled: string[];
	usage: RunUsage;
	/** HTTP status of a failed provider request (status only; never the body). */
	providerStatus?: number;
	/** Wall time of the failed provider request in ms. */
	providerMs?: number;
};

function newRunId(): string {
	return `xai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}


function turnMeta(
	path: LiveTurnMeta["path"],
	modelId: string,
	toolCallingWorked: boolean,
	steps: number,
	toolsCalled: string[],
	usage: RunUsage,
	runId: string
): LiveTurnMeta {
	return { runId, path, modelId, requestedModelId: modelId, toolCallingWorked, steps, toolsCalled, usage };
}


function classifyProviderFailure(status: number, snippet: string): { code: string; message: string } {
	const lower = snippet.toLowerCase();
	if (/tool|function.?call/.test(lower) && /not.?support|unavail|invalid|unknown/.test(lower)) {
		return {
			code: "tools_unsupported",
			message: "This Grok model rejected application tools. Tool support is not assumed. No other model was substituted."
		};
	}
	if (status === 404 || /model.?not.?found|unknown.?model|does not exist/.test(lower)) {
		return {
			code: "model_unavailable",
			message: "The requested Grok chat model is not available on this account. No fallback model was selected."
		};
	}
	if (status === 429) {
		return { code: "rate_limited", message: "The xAI chat request was rate limited. No automatic retry was sent." };
	}
	return { code: "xai_chat_failed", message: "The xAI chat request could not be completed. No automatic retry was sent." };
}


type ProviderStep =
	| { ok: true; message: ChatMessage }
	| { ok: false; result: AgentFailure; meta: LiveTurnMeta };

/** One chat/completions round trip. Failures carry only codes, the HTTP status and timing (never the body). */
async function providerStep(input: {
	baseUrl: string;
	apiKey: string;
	modelId: string;
	messages: ChatMessage[];
	tools: ReturnType<typeof agentOpenAiTools>;
	toolChoice: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
	maxTokens: number;
	signal: AbortSignal;
	stepUsage: StepUsage[];
	trace: { runId: string; steps: number; toolCallingWorked: boolean; toolsCalled: string[] };
}): Promise<ProviderStep> {
	const { trace } = input;
	const requestStarted = Date.now();
	const res = await silentFetch(`${input.baseUrl}/chat/completions`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${input.apiKey}`,
			"Content-Type": "application/json",
			Accept: "application/json"
		},
		body: JSON.stringify({
			model: input.modelId,
			messages: input.messages,
			tools: input.tools,
			// Choice comes from the versioned agent mode policy; the host may explicitly force a repair write.
			tool_choice: input.toolChoice,
			stream: false,
			max_tokens: input.maxTokens,
			temperature: 0
		}),
		signal: input.signal
	});
	const usageSoFar = () =>
		input.stepUsage.length ? aggregateStepUsage(input.stepUsage, { incomplete: "error" }) : unknownUsage("error", trace.steps);
	if (!res.ok) {
		const snippet = await res.text().then((text) => text.slice(0, 240), () => "");
		const failure = classifyProviderFailure(res.status, snippet);
		return {
			ok: false,
			result: { ok: false, code: failure.code, message: failure.message },
			meta: {
				...turnMeta("chat-completions", input.modelId, trace.toolCallingWorked, trace.steps, trace.toolsCalled, usageSoFar(), trace.runId),
				providerStatus: res.status,
				providerMs: Date.now() - requestStarted
			}
		};
	}
	const payload = (await res.json()) as {
		choices?: Array<{ finish_reason?: string; message?: ChatMessage }>;
		usage?: unknown;
		model?: string;
	};
	const used = typeof payload.model === "string" ? payload.model : input.modelId;
	const switched = assertNoFallback(input.modelId, used);
	if (switched) {
		return {
			ok: false,
			result: { ok: false, code: switched.code, message: switched.message },
			meta: turnMeta("chat-completions", input.modelId, trace.toolCallingWorked, trace.steps, trace.toolsCalled, unknownUsage("error", trace.steps), trace.runId)
		};
	}
	const usage = readProviderUsage(payload.usage);
	if (usage) input.stepUsage.push(usage);
	const message = payload.choices?.[0]?.message;
	if (!message) {
		return {
			ok: false,
			result: { ok: false, code: "malformed_response", message: "Chat completion had no message." },
			meta: turnMeta("chat-completions", input.modelId, trace.toolCallingWorked, trace.steps, trace.toolsCalled, usageSoFar(), trace.runId)
		};
	}
	return { ok: true, message };
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
	try {
		const parsed = JSON.parse(raw || "{}") as unknown;
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

function modelText(message: ChatMessage): string {
	return typeof message.content === "string" ? message.content.trim() : "";
}


/** The request after the nudge: Build forces the write_page call (Ask stays on auto). */
const FORCE_WRITE = { type: "function", function: { name: "write_page" } } as const;

const BUDGET = { maxSteps: RUN_BUDGET.maxToolCalls, maxTokens: 8192 } as const;

/** Identity of an error list: code, path and the rejected value; two equal lists in a row end the turn. A new value at the same path is a new attempt, not a repeat. */
function signature(issues: Array<{ path: string; code: string; got?: unknown }>): string {
	return JSON.stringify(issues.map((issue) => `${issue.code} ${issue.path} ${JSON.stringify(issue.got ?? null)}`).sort());
}

type TurnResultOut = { result: AgentReply | AgentFailure; meta: LiveTurnMeta };

type IssueSet = { signature: string; issues: Array<{ path: string; code: string; expected: string; got?: unknown }>; message: string };

/** What the loop has so far: the working page, the last accepted proposal, the last failed write, the catalog blocks read. */
type LoopState = { working: PageV2; proposal: PageProposal | null; lastIssues: IssueSet | null; stuck: IssueSet | null; blocks: string[]; accepted: boolean; rejected: AgentFailure["rejected"] | null };

type ToolCall = NonNullable<ChatMessage["tool_calls"]>[number];

/** One tool call of a step: the write (accepted, or the issue list and the stuck check) or a catalog read; the answer for the model. */
function runToolCall(ctx: TurnContext, state: LoopState, name: string, args: Record<string, unknown>): unknown {
	if (name === "write_page") {
		const written = runWriteTool(ctx, state.working, args);
		if (written.ok) {
			state.working = written.page;
			state.proposal = written.proposal;
			state.accepted = true;
			state.lastIssues = null;
			return written.payload;
		}
		state.rejected = rejectedWrite(args, written.issues, written.code);
		const sig = signature(written.issues);
		if (state.lastIssues?.signature === sig) state.stuck = { signature: sig, issues: written.issues, message: written.message };
		state.lastIssues = { signature: sig, issues: written.issues, message: written.message };
		return { ok: false, code: written.code, message: written.message, issues: written.issues };
	}
	const outcome = executeCatalogTool({ name, arguments: args }, { mode: ctx.mode, page: state.working });
	if (!outcome.ok) return { ok: false, code: outcome.code, message: outcome.message, ...(outcome.result ? { result: outcome.result } : {}) };
	if (name === "get_block") {
		const info = itemInfo(String((outcome.result as { item?: unknown }).item ?? ""));
		if (info) state.blocks.push(info.spec);
	}
	return outcome.result;
}

/** The result of a finished loop: the proposal, a stuck or invalid write, the text answer, or no answer. */
function loopResult(ctx: TurnContext, state: LoopState, text: string, steps: number, meta: LiveTurnMeta): TurnResultOut {
	const { stuck, proposal, lastIssues } = state;
	const rejected = state.rejected ? { rejected: state.rejected } : {};
	if (stuck) {
		const shown = stuck.issues.slice(0, 3).map((issue) => `${issue.path} ${issue.code}`).join("; ");
		return { result: { ok: false, code: "write_stuck", message: `The page was not written: the agent sent the same invalid page twice (${shown}). Nothing changed.`, issues: stuck.issues, ...rejected }, meta };
	}
	if (proposal && proposal.diff.length > 0) return { result: agentReply(ctx.mode, text, state.blocks, proposal), meta };
	if (lastIssues) return { result: { ok: false, code: "write_invalid", message: lastIssues.message, issues: lastIssues.issues, ...rejected }, meta };
	if (text) return { result: agentReply(ctx.mode, text, state.blocks), meta };
	return { result: { ok: false, code: "no_answer", message: `The model ended without an answer or a page write within ${steps} step${steps === 1 ? "" : "s"}.` }, meta };
}

async function agentLoop(apiKey: string, modelId: string, ctx: TurnContext, signal: AbortSignal, baseUrl: string): Promise<TurnResultOut> {
	const trace = { runId: newRunId(), steps: 0, toolCallingWorked: false, toolsCalled: [] as string[] };
	const stepUsage: StepUsage[] = [];
	// The turn-start probe: every block of the current page is rendered once, and the result serves the prompt and the nudge (ADR 0038).
	const problems = renderProblems(ctx.page);
	const messages: ChatMessage[] = [
		{ role: "system", content: ctx.mode === "ask" ? SYSTEM_ASK : SYSTEM_BUILD },
		{ role: "user", content: userPrompt(ctx, problems) }
	];
	const tools = agentOpenAiTools(ctx.mode);
	const state: LoopState = { working: ctx.page, proposal: null, lastIssues: null, stuck: null, blocks: [], accepted: false, rejected: null };
	let text = "";
	const finish = (): LiveTurnMeta => {
		// Complete when every request reported its usage; incomplete only for a request that did not (it was always marked incomplete before).
		const usage = stepUsage.length ? aggregateStepUsage(stepUsage, stepUsage.length < trace.steps ? { incomplete: "error" } : undefined) : unknownUsage("error", trace.steps);
		return turnMeta("chat-completions", modelId, trace.toolCallingWorked, trace.steps, trace.toolsCalled, usage, trace.runId);
	};
	let endedOnCalls = false;
	// Build asks for a tool call on every step (tool_choice "required"): the model reads with the catalog tools and ends with
	// write_page, and the turn ends with the first accepted write (no extra model step to summarize it). If a step still comes
	// back as plain text, the model is told once and the next request forces write_page by name. Ask stays on "auto"; Ask with
	// blocks that do not render (every block of the current page is probed at turn start) gets the one nudge as well.
	const build = ctx.mode === "build";
	const open = problems.length;
	const expectsChange = open > 0 || build;
	let nudged = false;
	let forceNamed = false;
	const changed = () => Boolean(state.proposal && state.proposal.diff.length > 0);
	const request = (toolChoice: Parameters<typeof providerStep>[0]["toolChoice"]) => providerStep({ baseUrl, apiKey, modelId, messages, tools, toolChoice, maxTokens: BUDGET.maxTokens, signal, stepUsage, trace });
	while (trace.steps < BUDGET.maxSteps && !state.stuck) {
		trace.steps += 1;
		endedOnCalls = false;
		let step = await request(forceNamed ? FORCE_WRITE : agentToolChoice(ctx.mode));
		// A model that refuses the named function gets "required".
		if (forceNamed && !step.ok && (step.meta.providerStatus === 400 || step.meta.providerStatus === 422)) step = await request("required");
		forceNamed = false;
		if (!step.ok) return { result: step.result, meta: step.meta };
		const message = step.message;
		const said = modelText(message);
		if (said) text = said;
		const calls: ToolCall[] = message.tool_calls ?? [];
		if (calls.length === 0) {
			if (expectsChange && !nudged && !changed() && trace.steps < BUDGET.maxSteps) {
				nudged = true;
				forceNamed = build;
				messages.push({ role: "assistant", content: said || "" }, { role: "user", content: nudgeText(ctx, open) });
				continue;
			}
			break;
		}
		endedOnCalls = true;
		trace.toolCallingWorked = true;
		messages.push({ role: "assistant", content: message.content ?? null, tool_calls: calls });
		state.accepted = false;
		for (const call of calls) {
			const name = call.function?.name ?? "";
			trace.toolsCalled.push(name);
			const reply = runToolCall(ctx, state, name, parseArgs(call.function?.arguments));
			messages.push({ role: "tool", tool_call_id: call.id, name, content: JSON.stringify(reply) });
		}
		// Build ends with the accepted write.
		// The text beside the call is not an answer (a model may print the document there): the host shows the diff card and the status.
		if (build && state.accepted) {
			text = "";
			endedOnCalls = false;
			break;
		}
	}
	if (endedOnCalls && !state.stuck && !changed()) {
		// The step budget ended on tool calls: one more request, no tools, so the model answers with what it read.
		const last = await request("none");
		if (last.ok) text = modelText(last.message) || text;
	}
	return loopResult(ctx, state, text, trace.steps, finish());
}

type TurnResult = AgentReply | AgentFailure;

export async function runXaiCatalogTurn(apiKey: string, modelId: string, ctx: TurnContext, signal: AbortSignal, baseUrl: string = DEFAULT_XAI_BASE_URL): Promise<{ result: TurnResult; meta: LiveTurnMeta }> {
	try {
		return await agentLoop(apiKey, modelId, ctx, signal, baseUrl);
	} catch (err) {
		const safe = safeErrorMessage(err, [apiKey]);
		const aborted = safe.code === "AbortError" || safe.message.toLowerCase().includes("abort") || signal.aborted;
		// The caller only sees a generic failure; the function log must name the exception (redacted, 280 chars).
		if (!aborted) console.error(JSON.stringify({ runtime: "xai-grok", event: "xai_run_exception", modelId, name: err instanceof Error ? err.name : typeof err, code: safe.code, message: safe.message }));
		return {
			result: {
				ok: false,
				code: aborted ? "aborted" : "xai_chat_failed",
				message: aborted ? "The run was cancelled. Usage is unknown, not zero." : "The xAI chat request could not be completed. No automatic retry was sent."
			},
			meta: turnMeta("chat-completions", modelId, false, 0, [], unknownUsage(aborted ? "cancelled" : "error", 0), newRunId())
		};
	}
}

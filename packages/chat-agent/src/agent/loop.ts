/** Shared page-agent loop. The host injects transport; schema and render gates remain shared. */
import { itemInfo, renderProblems } from "@buildytech/builder-core";
import { AGENT_BUDGET, type BudgetCounts } from "./budget.ts";
import type { ExecutionBudget } from "../scenarios/compile.ts";
import type { PageV2 } from "@buildytech/page-contract";
import { agentTools, agentToolChoice } from "./agent-tools.ts";
import { agentReply, rejectedWrite, runWriteTool, type AgentFailure, type AgentReply, type PageProposal, type TurnContext } from "./turn.ts";
import { createExecution, type ExecutionOptions } from "./execution.ts";
import { executeCatalogTool } from "./catalog-tools.ts";
import { SYSTEM_ASK, SYSTEM_BUILD, nudgeText, userPrompt } from "./prompts.ts";
import { type AgentProvider, type AgentMessage, type LiveTurnMeta } from "./provider.ts";

function parseArgs(raw: string | undefined): Record<string, unknown> {
	try {
		const parsed = JSON.parse(raw || "{}") as unknown;
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

function modelText(message: AgentMessage): string {
	return typeof message.text === "string" ? message.text.trim() : "";
}


/** The request after the nudge: Build forces the write_page call (Ask stays on auto). */
const FORCE_WRITE = { name: "write_page" } as const;

/** Identity of an error list: code, path and the rejected value; two equal lists in a row end the turn. A new value at the same path is a new attempt, not a repeat. */
function signature(issues: Array<{ path: string; code: string; got?: unknown }>): string {
	return JSON.stringify(issues.map((issue) => `${issue.code} ${issue.path} ${JSON.stringify(issue.got ?? null)}`).sort());
}

type TurnResultOut = { result: AgentReply | AgentFailure; meta: LiveTurnMeta };

type IssueSet = { signature: string; issues: Array<{ path: string; code: string; expected: string; got?: unknown }>; message: string };

/** What the loop has so far: the working page, the last accepted proposal, the last failed write, the catalog blocks read. */
type LoopState = { working: PageV2; proposal: PageProposal | null; lastIssues: IssueSet | null; stuck: IssueSet | null; blocks: string[]; accepted: boolean; rejected: AgentFailure["rejected"] | null };

type ToolCall = NonNullable<AgentMessage["calls"]>[number];

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


function runCalls(ctx: TurnContext, state: LoopState, calls: ToolCall[], counts: BudgetCounts, toolsCalled: string[], messages: AgentMessage[], budget: Pick<ExecutionBudget, "maxToolCalls" | "maxWriteAttempts">, execution: ReturnType<typeof createExecution>, allowed: string[]): AgentFailure | null {
	let wrote = false;
	for (const call of calls) {
		const name = call.name ?? "";
		if (counts.toolCalls >= budget.maxToolCalls || (name === "write_page" && !wrote && counts.writeAttempts >= budget.maxWriteAttempts)) {
			return { ok: false, code: "tool_budget", message: "The tool or write-attempt budget was reached. No further tools were executed." };
		}
		counts.toolCalls += 1;
		toolsCalled.push(name);
		const duplicateWrite = name === "write_page" && wrote;
		if (name === "write_page" && !wrote) { wrote = true; counts.writeAttempts += 1; }
		const started = Date.now();
		const reply = !allowed.includes(name) ? { ok: false, code: "tool_not_allowed" } : duplicateWrite ? { ok: false, code: "multiple_writes", message: "Only one write_page attempt per provider response is allowed." } : runToolCall(ctx, state, name, parseArgs(call.argumentsJson));
		execution.recorder.tool(call, reply, Date.now() - started, state.proposal);
		messages.push({ role: "tool", callId: call.id, name, text: JSON.stringify(reply) });
	}
	return null;
}

export async function runAgentLoop(modelId: string, ctx: TurnContext, signal: AbortSignal, provider: AgentProvider, runId: string, options: ExecutionOptions = {}): Promise<TurnResultOut> {
	const scenario = options.scenario;
	if (scenario && (scenario.modelId !== modelId || scenario.profile.mode !== ctx.mode)) throw new Error("Scenario binding mismatch");
	const execution = createExecution(modelId, signal, provider, runId, options);
	try { return await runLoop(ctx, options, execution); }
	catch (error) { const failed = execution.failure(error); return { result: failed.result, meta: failed.meta }; }
}

async function runLoop(ctx: TurnContext, options: ExecutionOptions, execution: ReturnType<typeof createExecution>): Promise<TurnResultOut> {
	const scenario = options.scenario;
	const budget = scenario?.budget ?? AGENT_BUDGET;
	const { trace, counts, finish, stopped, request: send } = execution;
	// The turn-start probe: every block of the current page is rendered once, and the result serves the prompt and the nudge (ADR 0038).
	const problems = renderProblems(ctx.page);
	const messages: AgentMessage[] = [
		{ role: "system", text: scenario?.systemPrompt ?? (ctx.mode === "ask" ? SYSTEM_ASK : SYSTEM_BUILD) },
		{ role: "user", text: scenario ? scenario.context(ctx, problems) : userPrompt(ctx, problems) }
	];
	const tools = scenario?.tools ?? agentTools(ctx.mode);
	const state: LoopState = { working: ctx.page, proposal: null, lastIssues: null, stuck: null, blocks: [], accepted: false, rejected: null };
	let text = "";
	let endedOnCalls = false;
	// Build asks for a tool call on every step (tool_choice "required"): the model reads with the catalog tools and ends with
	// write_page, and the turn ends with the first accepted write (no extra model step to summarize it). If a step still comes
	// back as plain text, the model is told once and the next request forces write_page by name. Ask stays on "auto"; Ask with
	// blocks that do not render (every block of the current page is probed at turn start) gets the one nudge as well.
	const build = ctx.mode === "build";
	const open = problems.length;
	const canWrite = tools.some((tool) => tool.name === "write_page");
	const expectsChange = canWrite && (open > 0 || build);
	let nudged = false;
	let forceNamed = false;
	const changed = () => Boolean(state.proposal && state.proposal.diff.length > 0);
	execution.recorder.prefix(messages, tools);
	const request = (toolChoice: Parameters<typeof send>[0]["toolChoice"]) => send({ messages, tools, toolChoice, nudged });
	let steps = 0;
	while (steps < budget.maxSteps && !state.stuck) {
		steps += 1;
		execution.recorder.loopStep();
		endedOnCalls = false;
		let step = await request(forceNamed ? FORCE_WRITE : scenario?.toolChoice ?? agentToolChoice(ctx.mode));
		// A model that refuses the named function gets "required".
		if (forceNamed && !step.ok && (step.meta.providerStatus === 400 || step.meta.providerStatus === 422)) step = await request("required");
		forceNamed = false;
		if (!step.ok) return { result: step.result, meta: { ...step.meta, ...finish() } };
		const message = step.message;
		const said = modelText(message);
		if (said) text = said;
		const calls: ToolCall[] = message.calls ?? [];
		if (calls.length === 0) {
			if (expectsChange && !nudged && !changed() && steps < budget.maxSteps) {
				nudged = true;
				forceNamed = build;
				messages.push({ role: "assistant", text: said || "" }, { role: "user", text: scenario ? scenario.nudge(ctx, open) : nudgeText(ctx, open) });
				continue;
			}
			break;
		}
		endedOnCalls = true;
		trace.toolCallingWorked = true;
		messages.push({ role: "assistant", text: message.text ?? "", calls });
		state.accepted = false;
		const stop = stopped();
		if (stop && !stop.ok) return { result: stop.result, meta: stop.meta };
		const failure = runCalls(ctx, state, calls, counts, trace.toolsCalled, messages, budget, execution, tools.map((tool) => tool.name));
		if (failure) { execution.recorder.stop(failure.code); return { result: failure, meta: finish() }; }
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
		if (!last.ok) return { result: last.result, meta: { ...last.meta, ...finish() } };
		if (last.ok) text = modelText(last.message) || text;
	}
	const result = loopResult(ctx, state, text, trace.steps, finish());
	execution.recorder.stop(result.result.ok ? (state.accepted ? "proposal_accepted" : "answer") : result.result.code);
	return { ...result, meta: finish() };
}

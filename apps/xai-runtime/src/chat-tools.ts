/**
 * The agent turn on xAI chat completions (ADR 0034). One loop for Ask and Build: the model reads the page document and the
 * registry (get_page, get_block, search_catalog) and writes with one tool, write_page (a whole page or an RFC 6902 patch).
 * The host gates every write (page-spec/v2 schema, registry props schema, selection scope,
 * collection) and answers with the diff or a list of { path, code, expected, got }; the model fixes its own document. The
 * loop stops after two identical error lists. There is no local repair, no operation taxonomy, no phrase recognition.
 */
import { RUN_BUDGET, collectionPromptContext, itemInfo, renderProblems } from "@buildytech/builder-core";
import { XAI_BASE_URL, agentOpenAiTools, agentReply, aggregateStepUsage, assertNoFallback, executeCatalogTool, itemIndex, propsOutline, readProviderUsage, runWriteTool, safeErrorMessage, unknownUsage, type AgentFailure, type AgentReply, type PageProposal, type RunUsage, type StepUsage, type TurnContext } from "@buildytech/chat-agent";
import type { PageV2 } from "@buildytech/page-contract";
import { installPropsGate } from "@buildytech/builder-core/props-gate";

// Program-level props gate (Ajv 2020 over the pinned registry props schemas); fail-closed until installed.
installPropsGate();

const SYSTEM_COMMON = [
	"You are the BuildY page agent. The page is ONE JSON document, the same one the export emits:",
	'{ "version": 2, "title", "slug", "locale", "seo": { "title", "description" }, "blocks": [{ "id", "item", "variant", "props" }] }.',
	"- item is a registry item (npx ui8kit add <item>); itemIndex lists every item with its variants (header / footer roles are marked as information only). variant is one of the item's variants.",
	"- props are exactly the component props of the item. get_block shows them (names, kinds, enums, rows; ? = optional) and the sample props a new block starts with. Write real text in every text prop, never placeholders such as Title, Text or Lorem. A list is an array of records with every required field; an icon is a real Lucide icon name in kebab-case: an unknown name is rejected with its path and the nearest real names, pick one of those.",
	"- Hard rules only: every block's props pass the item's props schema and the item renders. Everything else is your design decision, header and footer included (the roles in itemIndex are information, not rules: a banner may stand above a header, a page may hold several headers, a footer may stand anywhere): pick, replace, add, remove and reorder blocks as the request needs. Screens from search_catalog are hints, never constraints.",
	"- write_page is the only write. Send { page } (the whole document) or { patch } (RFC 6902 operations on the document, paths as JSON Pointers: /title, /locale, /seo/description, /blocks/2/props/title, /blocks/- to append). A block you add needs only { item, variant }: the host starts it from the registry sample props, then applies the props you give. A block without id gets one; keep the ids of blocks you keep.",
	"- write_page answers with the diff, or with a list [{ path, code, expected, got }] and changes nothing: fix exactly those paths and write again. Never repeat a write that failed the same way. Besides the schema codes, render_failed and render_empty mean the block would throw or show nothing in the preview (the host rendered it): fix the prop at that path (the page you read may list such blocks in renderProblems).",
	"- locale is the ISO code of the language the author writes in (ru for Russian, en for English): set it and write all page text in that language. seo.title and seo.description are real text for this page. title is the name of what the request is about (the business, product or topic), never a template or catalog name. A request that starts a page gets assembly and content in ONE write_page: every block with its real texts, items and images.",
	"- scope.blockIds, when present, are the blocks the author selected: edit only those (props, variant, item). Do not change page fields, other blocks, or the order.",
	"- currency is an ISO 4217 code (RUB, USD, EUR), never a symbol such as ₽ or $.",
	"- Write content when asked. A fictional product is fine when the author says so; never present invented facts as real ones when the author gave real ones.",
	"- Never apply or publish: the author applies a proposal. Answer in the author's language, briefly: what changed and why."
].join("\n");

const SYSTEM_BUILD = `${SYSTEM_COMMON}\n- Build: every step is a tool call. Read with the catalog tools, then change the page with write_page: the whole document goes into the call, never into the text. The turn ends when write_page is accepted. If the request needs no change, write the current page back unchanged.`;

const SYSTEM_ASK = `${SYSTEM_COMMON}\n- Ask: a read-only conversation about the page and the catalog. Answer questions in text. When your answer recommends changes to the page, call write_page once with exactly those changes: it becomes a proposal the author can apply in Build with one click (nothing is applied by Ask). Do not write when you only explain.`;

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


export type LiveTurnMeta = {
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
	const res = await silentFetch(`${XAI_BASE_URL}/chat/completions`, {
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
			// The author picks Ask or Build in the composer; the model decides whether to call a tool (ADR-0011).
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


const HOST_FIELDS = ["id", "status", "createdAt", "updatedAt"] as const;

/** The page document the model reads: without host-managed fields. */
function pageView(page: PageV2): Record<string, unknown> {
	const view: Record<string, unknown> = { ...page };
	for (const key of HOST_FIELDS) delete view[key];
	return view;
}

function userPrompt(ctx: TurnContext, problems: ReturnType<typeof renderProblems>): string {
	const items = [...new Set(ctx.page.blocks.map((block) => block.item))];
	const outlines = Object.fromEntries(items.map((item) => [item, propsOutline(item)]).filter(([, lines]) => lines));
	return JSON.stringify({
		request: ctx.brief,
		...(ctx.conversation?.length ? { conversation: ctx.conversation } : {}),
		page: pageView(ctx.page),
		...(problems.length ? { renderProblems: problems, renderProblemsNote: "These blocks throw or show nothing in the preview now. Fix them with write_page (the prop at each path), or replace the block." } : {}),
		...(ctx.scopeBlockIds?.length ? { scope: { blockIds: ctx.scopeBlockIds } } : {}),
		...(ctx.screenId ? { screenHint: ctx.screenId } : {}),
		...(ctx.collection ? { collection: collectionPromptContext(ctx.collection) } : {}),
		propsOfBlocksOnPage: outlines,
		itemIndex: itemIndex()
	});
}

/**
 * Sent once when a turn that is expected to change the page ends without an accepted write (ADR 0035). Program text, no phrase
 * recognition. In Build the request that follows forces write_page (tool_choice), so the text says the document goes into the
 * call and is never printed; Ask keeps the way out of saying plainly that the page does not change.
 */
function nudgeText(ctx: TurnContext, problems: number): string {
	const build = ctx.mode === "build";
	return [
		"Host notice: nothing on the page has changed in this turn (no write_page was accepted).",
		problems > 0 ? "The page has blocks that do not render; they are listed in renderProblems (get_page shows them)." : ctx.scopeBlockIds?.length ? "Blocks are selected for this edit." : "",
		build
			? "Call write_page with the page document now; the document goes into the call, do not print it in the text. Do not report a change that write_page did not accept."
			: "Call write_page now with the change, or say plainly that you are not changing the page and why. Do not report a change that write_page did not accept."
	].filter(Boolean).join(" ");
}

/** The request after the nudge: Build forces the write_page call (Ask stays on auto). */
const FORCE_WRITE = { type: "function", function: { name: "write_page" } } as const;

const BUDGET = { maxSteps: RUN_BUDGET.maxToolCalls, maxTokens: 8192 } as const;

/** Identity of an error list: code, path and the rejected value; two equal lists in a row end the turn. A new value at the same path is a new attempt, not a repeat. */
function signature(issues: Array<{ path: string; code: string; got?: unknown }>): string {
	return JSON.stringify(issues.map((issue) => `${issue.code} ${issue.path} ${JSON.stringify(issue.got ?? null)}`).sort());
}

type TurnResultOut = { result: AgentReply | AgentFailure; meta: LiveTurnMeta };

async function agentLoop(apiKey: string, modelId: string, ctx: TurnContext, signal: AbortSignal): Promise<TurnResultOut> {
	const trace = { runId: newRunId(), steps: 0, toolCallingWorked: false, toolsCalled: [] as string[] };
	const stepUsage: StepUsage[] = [];
	// The turn-start probe: every block of the current page is rendered once, and the result serves the prompt and the nudge (ADR 0038).
	const problems = renderProblems(ctx.page);
	const messages: ChatMessage[] = [
		{ role: "system", content: ctx.mode === "ask" ? SYSTEM_ASK : SYSTEM_BUILD },
		{ role: "user", content: userPrompt(ctx, problems) }
	];
	const tools = agentOpenAiTools(ctx.mode);
	let working: PageV2 = ctx.page;
	let proposal: PageProposal | null = null;
	let text = "";
	const blocks: string[] = [];
	type IssueSet = { signature: string; issues: Array<{ path: string; code: string; expected: string; got?: unknown }>; message: string };
	let lastIssues = null as IssueSet | null;
	let stuck = null as IssueSet | null;
	const finish = (): TurnResultOut["meta"] => {
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
	const changed = () => Boolean(proposal && proposal.diff.length > 0);
	while (trace.steps < BUDGET.maxSteps && !stuck) {
		trace.steps += 1;
		endedOnCalls = false;
		const choice = forceNamed ? FORCE_WRITE : build ? "required" : "auto";
		let step = await providerStep({ apiKey, modelId, messages, tools, toolChoice: choice, maxTokens: BUDGET.maxTokens, signal, stepUsage, trace });
		// A model that refuses the named function gets "required".
		if (forceNamed && !step.ok && (step.meta.providerStatus === 400 || step.meta.providerStatus === 422)) {
			step = await providerStep({ apiKey, modelId, messages, tools, toolChoice: "required", maxTokens: BUDGET.maxTokens, signal, stepUsage, trace });
		}
		forceNamed = false;
		if (!step.ok) return { result: step.result, meta: step.meta };
		const message = step.message;
		const said = modelText(message);
		if (said) text = said;
		const calls = message.tool_calls ?? [];
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
		let accepted = false;
		for (const call of calls) {
			const name = call.function?.name ?? "";
			trace.toolsCalled.push(name);
			const args = parseArgs(call.function?.arguments);
			let reply: unknown;
			if (name === "write_page") {
				const written = runWriteTool(ctx, working, args);
				if (written.ok) {
					working = written.page;
					proposal = written.proposal;
					accepted = true;
					lastIssues = null;
					reply = written.payload;
				} else {
					const sig = signature(written.issues);
					reply = { ok: false, code: written.code, message: written.message, issues: written.issues };
					if (lastIssues?.signature === sig) stuck = { signature: sig, issues: written.issues, message: written.message };
					lastIssues = { signature: sig, issues: written.issues, message: written.message };
				}
			} else {
				const outcome = executeCatalogTool({ name, arguments: args }, { mode: ctx.mode, page: working });
				if (outcome.ok) {
					reply = outcome.result;
					if (name === "get_block") {
						const info = itemInfo(String((outcome.result as { item?: unknown }).item ?? ""));
						if (info) blocks.push(info.spec);
					}
				} else reply = { ok: false, code: outcome.code, message: outcome.message, ...(outcome.result ? { result: outcome.result } : {}) };
			}
			messages.push({ role: "tool", tool_call_id: call.id, name, content: JSON.stringify(reply) });
		}
		// Build ends with the accepted write; the answer is the model's text beside the call, if any (the host shows the diff and the status).
		if (build && accepted) {
			text = said;
			endedOnCalls = false;
			break;
		}
	}
	if (endedOnCalls && !stuck && !changed()) {
		// The step budget ended on tool calls: one more request, no tools, so the model answers with what it read.
		const last = await providerStep({ apiKey, modelId, messages, tools, toolChoice: "none", maxTokens: BUDGET.maxTokens, signal, stepUsage, trace });
		if (last.ok) text = modelText(last.message) || text;
	}
	const meta = finish();
	if (stuck) {
		return {
			result: {
				ok: false,
				code: "write_stuck",
				message: `The page was not written: the agent sent the same invalid page twice (${stuck.issues.slice(0, 3).map((issue) => `${issue.path} ${issue.code}`).join("; ")}). Nothing changed.`,
				issues: stuck.issues
			},
			meta
		};
	}
	if (proposal && changed()) return { result: agentReply(ctx.mode, text, blocks, proposal), meta };
	if (lastIssues) {
		return { result: { ok: false, code: "write_invalid", message: lastIssues.message, issues: lastIssues.issues }, meta };
	}
	if (text) return { result: agentReply(ctx.mode, text, blocks), meta };
	return { result: { ok: false, code: "no_answer", message: `The model ended without an answer or a page write within ${trace.steps} step${trace.steps === 1 ? "" : "s"}.` }, meta };
}

export type TurnResult = AgentReply | AgentFailure;

export async function runXaiCatalogTurn(apiKey: string, modelId: string, ctx: TurnContext, signal: AbortSignal): Promise<{ result: TurnResult; meta: LiveTurnMeta }> {
	try {
		return await agentLoop(apiKey, modelId, ctx, signal);
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

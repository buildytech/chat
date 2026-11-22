import { propsOutline } from "./blocks.ts";
import { systemText } from "./prompts.ts";
import { pageForModel, propsSchemaFor } from "@buildytech/builder-core";
import { createExecution, type ExecutionOptions } from "./execution.ts";
import { agentReply, runWriteTool, rejectedWrite, type TurnContext } from "./turn.ts";
import type { AgentProvider, AgentMessage } from "./provider.ts";

export const FIELDS_PROMPT = "Edit the selected registry block props only. Preserve fields the author did not ask to change. Use write_page with exactly one replace operation at the supplied path and the COMPLETE corrected props object for value. Never return page, change item/variant/block identity/order or invent fields, facts or image URLs. On repair correct the candidate using the supplied errors. No prose. The registry-derived field outline follows. The host validates the full props schema.";
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }

export function fieldsContext(ctx: TurnContext): string {
	const index = ctx.page.blocks.findIndex((block) => block.id === ctx.scopeBlockIds?.[0]);
	const block = pageForModel(ctx.page).blocks[index];
	return block ? JSON.stringify({ request: ctx.brief, locale: ctx.page.locale, blockId: block.id, item: block.item, variant: block.variant, path: `/blocks/${index}/props`, object: block.props, errors: [] }) : "{}";
}

export async function editFields(modelId: string, ctx: TurnContext, signal: AbortSignal, provider: AgentProvider, runId: string, options: ExecutionOptions) {
	const execution = createExecution(modelId, signal, provider, runId, options);
	const scenario = options.scenario!;
	const done = (result: import("./turn.ts").AgentReply | import("./turn.ts").AgentFailure) => {
		execution.recorder.stop(result.ok ? "proposal_accepted" : result.code);
		return { result, meta: execution.finish() };
	};
	try {
		const index = ctx.page.blocks.findIndex((block) => block.id === ctx.scopeBlockIds?.[0]);
		if (ctx.scopeBlockIds?.length !== 1 || index < 0) return done({ ok: false, code: "fields_scope", message: "Select exactly one existing block for field editing." });
		const block = ctx.page.blocks[index]!;
		const schema = propsSchemaFor(block.item);
		if (!schema) return done({ ok: false, code: "fields_schema", message: "The registry props schema is unavailable." });
		const path = `/blocks/${index}/props`;
		let object: unknown = pageForModel(ctx.page).blocks[index]!.props;
		let errors: unknown = [];
		let previous = "";
		let rejected: import("./turn.ts").AgentFailure["rejected"];
		const system = `${systemText(scenario.systemPrompt, ctx)}\n${JSON.stringify({ fields: propsOutline(block.item) })}`;
		for (let step = 0; step < scenario.budget.maxSteps; step += 1) {
			const messages: AgentMessage[] = [{ role: "system", text: system }, { role: "user", text: JSON.stringify({ request: ctx.brief, locale: ctx.page.locale, blockId: block.id, item: block.item, variant: block.variant, path, object, errors }) }];
			if (step === 0) execution.recorder.prefix(messages, scenario.tools);
			execution.recorder.loopStep();
			let response = await execution.request({ messages, tools: scenario.tools, toolChoice: { name: "write_page" }, phase: step ? "repair" : "write" });
			if (!response.ok && (response.meta.providerStatus === 400 || response.meta.providerStatus === 422)) response = await execution.request({ messages, tools: scenario.tools, toolChoice: "required", phase: step ? "repair" : "write", completionReason: "named_fallback" });
			if (!response.ok) return { result: response.result, meta: response.meta };
			const calls = response.message.calls ?? [];
			execution.trace.toolCallingWorked ||= calls.length > 0;
			let args: unknown;
			try { args = JSON.parse(calls[0]?.argumentsJson ?? "null"); } catch { args = null; }
			const patch = record(args) && Array.isArray(args.patch) && args.patch.length === 1 ? args.patch[0] : null;
			const valid = calls.length === 1 && calls[0]?.name === "write_page" && record(args) && Object.keys(args).every((key) => key === "patch") && record(patch) && Object.keys(patch).every((key) => ["op", "path", "value"].includes(key)) && patch.op === "replace" && patch.path === path && record(patch.value);
			if (!valid) { for (const call of calls) execution.recorder.tool(call, { ok: false, code: "fields_protocol" }, 0, null, undefined, false); errors = [{ path, code: "fields_protocol", expected: "exactly one write_page patch replacing the selected props object" }]; continue; }
			if (execution.counts.toolCalls >= scenario.budget.maxToolCalls || execution.counts.writeAttempts >= scenario.budget.maxWriteAttempts) return done({ ok: false, code: "tool_budget", message: "Field edit attempts reached their configured ceiling.", rejected });
			execution.counts.toolCalls += 1;
			execution.counts.writeAttempts += 1;
			execution.trace.toolsCalled.push("write_page");
			const started = Date.now();
			const written = runWriteTool(ctx, ctx.page, { patch: [patch] });
			execution.recorder.tool(calls[0]!, written.ok ? written.payload : { ok: false, issues: written.issues, code: written.code }, Date.now() - started, written.ok ? written.proposal : null);
			if (written.ok) return done(agentReply("build", "", [block.item], written.proposal));
			rejected = rejectedWrite({ patch: [patch] }, written.issues, written.code);
			if (written.issues.some((issue) => issue.path !== `/blocks/${index}` && !issue.path.startsWith(`${path}/`) && issue.path !== path)) return done({ ok: false, code: "fields_external_error", message: "Validation needs changes outside the selected block. Choose a wider editing scope.", rejected });
			object = patch.value;
			errors = written.issues.map(({ path: errorPath, code, expected, got }) => ({ path: errorPath, code, expected: expected.slice(0, 800), ...(typeof got === "string" ? { got: got.slice(0, 200) } : {}) }));
			const signature = JSON.stringify({ object, errors });
			if (signature === previous) return done({ ok: false, code: "write_stuck", message: "The same field edit failed twice.", issues: written.issues, rejected });
			previous = signature;
		}
		return done({ ok: false, code: "fields_unfinished", message: "The field edit was not accepted. No page changes were made.", rejected });
	} catch (error) { const failed = execution.failure(error); return { result: failed.result, meta: failed.meta }; }
}

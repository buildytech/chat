import assert from "node:assert/strict";
import { test } from "node:test";
import {
	COST_UNAVAILABLE,
	aggregateSessionUsage,
	aggregateStepUsage,
	costForModel,
	formatTokens,
	readProviderUsage,
	unknownUsage
} from "../../packages/builder-core/src/usage.ts";

test("tool-loop sums actual steps without double-counting totals", () => {
	const run = aggregateStepUsage([
		readProviderUsage({ prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }),
		readProviderUsage({ prompt_tokens: 140, completion_tokens: 10, total_tokens: 150 }),
		readProviderUsage({ prompt_tokens: 160, completion_tokens: 5, total_tokens: 165 })
	]);
	assert.equal(run.status, "complete");
	assert.equal(run.steps, 3);
	assert.equal(run.promptTokens, 400);
	assert.equal(run.completionTokens, 35);
	assert.equal(run.totalTokens, 435);
	assert.equal(run.reportedBy, "xai-provider");
	assert.equal(run.aggregation, "sum-of-tool-loop-requests");
	assert.equal(run.lastStep?.promptTokens, 160);
	assert.equal(run.lastStep?.completionTokens, 5);
	assert.notEqual(run.totalTokens, 120 + 150 + 165 + 400 + 35);
});

test("reasoning and cache appear only when the provider sent them", () => {
	const withDetail = aggregateStepUsage([
		readProviderUsage({
			prompt_tokens: 50,
			completion_tokens: 10,
			total_tokens: 60,
			prompt_tokens_details: { cached_tokens: 12 },
			completion_tokens_details: { reasoning_tokens: 8 }
		})
	]);
	assert.equal(withDetail.cachedTokens, 12);
	assert.equal(withDetail.reasoningTokens, 8);
	const plain = aggregateStepUsage([readProviderUsage({ prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 })]);
	assert.equal(plain.cachedTokens, undefined);
	assert.equal(plain.reasoningTokens, undefined);
});

test("cancelled and error usage is UNKNOWN not zero", () => {
	const cancelled = unknownUsage("cancelled", 2);
	assert.equal(cancelled.status, "incomplete");
	assert.equal(cancelled.incompleteReason, "cancelled");
	assert.equal(cancelled.promptTokens, "unknown");
	assert.equal(cancelled.completionTokens, "unknown");
	assert.equal(cancelled.totalTokens, "unknown");
	assert.equal(cancelled.reportedBy, "none");
	assert.notEqual(cancelled.promptTokens, 0);
	const errored = aggregateStepUsage([], { incomplete: "error" });
	assert.equal(errored.totalTokens, "unknown");
	assert.equal(formatTokens(errored.totalTokens), "UNKNOWN");
	const partial = aggregateStepUsage(
		[readProviderUsage({ prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 })],
		{ incomplete: "cancelled" }
	);
	assert.equal(partial.status, "incomplete");
	assert.equal(partial.promptTokens, 10);
});

test("session totals mark incomplete and never invent dollars", () => {
	const session = aggregateSessionUsage([
		aggregateStepUsage([readProviderUsage({ prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 })]),
		unknownUsage("error")
	]);
	assert.equal(session.status, "incomplete");
	assert.equal(session.runs, 2);
	assert.equal(session.incompleteRuns, 1);
	assert.equal(session.promptTokens, "unknown");
	assert.equal(session.cost, COST_UNAVAILABLE);
	assert.equal(session.cost.available, false);
	const dollars = costForModel("grok-4.7", unknownUsage("error"));
	assert.equal(dollars.available, false);
	assert.equal(dollars.reason, "no_official_current_rates_in_repo");
	assert.equal("amount" in dollars, false);
});

/** Separate ceilings: a provider response may contain many tool calls. */
export const AGENT_BUDGET = {
	maxSteps: 8,
	maxRequests: 10,
	maxToolCalls: 32,
	maxWriteAttempts: 8,
	maxTokens: 8192,
	toolPageSize: 4
} as const;

export type BudgetCounts = { requests: number; toolCalls: number; writeAttempts: number };

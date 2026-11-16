/** Versioned execution policy; old registered scenarios retain zero transient retries. */
export const CURRENT_EXECUTION_POLICY = { id: "page-loop@2", maxTransientRetries: 1, baseDelayMs: 250, maxDelayMs: 2000 } as const;
const policies = [{ id: "page-loop@1", maxTransientRetries: 0, baseDelayMs: 250, maxDelayMs: 2000 }, CURRENT_EXECUTION_POLICY] as const;
export function executionPolicy(id: string) { return policies.find((policy) => policy.id === id) ?? null; }

export function retryDelay(error: { status?: number; retryable?: boolean; retryAfterMs?: number }, used: number, policy: (typeof policies)[number], remainingMs: number): number | null {
	if (!error.retryable || ![429, 500, 502, 503, 504].includes(error.status ?? 0) || used >= policy.maxTransientRetries) return null;
	const delay = Math.max(policy.baseDelayMs * 2 ** used, error.retryAfterMs ?? 0);
	return Number.isFinite(delay) && delay <= policy.maxDelayMs && delay < remainingMs ? delay : null;
}

/** Cancellation ends the wait and releases both the timer and listener. The caller rechecks before dispatch. */
export function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal.aborted) { resolve(); return; }
		const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
		const timer = setTimeout(done, ms);
		signal.addEventListener("abort", done, { once: true });
	});
}

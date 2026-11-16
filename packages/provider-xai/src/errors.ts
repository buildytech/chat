export function retryAfterMs(value: string | null, now = Date.now()): number | undefined {
	if (value === null) return undefined;
	const seconds = /^[0-9]+(?:\.[0-9]+)?$/.test(value.trim()) ? Number(value) : NaN;
	const ms = Number.isFinite(seconds) ? seconds * 1000 : /^[A-Za-z]{3}, [0-9]{2} [A-Za-z]{3} [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT$/.test(value.trim()) ? Date.parse(value) - now : NaN;
	return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
}

export function classifyProviderFailure(status: number, snippet: string) {
	if (status === 401) return { code: "provider_unauthorized", message: "The provider rejected authentication.", retryable: false };
	if (status === 403) return { code: "provider_forbidden", message: "The provider denied access.", retryable: false };
	if (status === 429) return { code: "rate_limited", message: "The provider rate limit was reached.", retryable: true };
	if (status >= 500) return { code: "provider_unavailable", message: "The provider service failed.", retryable: [500, 502, 503, 504].includes(status) };
	const lower = snippet.toLowerCase();
	if (/tool|function.?call/.test(lower) && /not.?support|unavail|invalid|unknown/.test(lower)) return { code: "tools_unsupported", message: "The model rejected application tools. No other model was substituted.", retryable: false };
	if (status === 404 || /model.?not.?found|unknown.?model|does not exist/.test(lower)) return { code: "model_unavailable", message: "The requested model is unavailable. No fallback was selected.", retryable: false };
	return { code: "provider_failed", message: "The provider rejected the request.", retryable: false };
}

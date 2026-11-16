/** Exact billed amounts: decimal strings survive JSON and browser persistence without floating point rounding. */
type BilledCost = {
	available: true; kind: "billed"; currency: "USD"; ticks: string; usd: string;
	completeness: "complete" | "partial"; reportedRequests: number; requests: number;
};
type CostUnavailable = { available: false; reason: "not_reported" | "no_official_current_rates_in_repo"; note: string };
type CostEstimate = { available: true; kind: "estimated"; currency: "USD"; amount: number; modelId: string; source: string; asOf: string; vsBilled: "estimated_not_billed" };
export type UsageCost = BilledCost | CostUnavailable | CostEstimate;
export const COST_UNAVAILABLE: CostUnavailable = { available: false, reason: "not_reported", note: "Billed cost is unavailable in this usage record. Missing cost is unknown, never zero." };
type CostPart = { ticks?: string; reportedRequests: number; requests: number; complete: boolean };

export function readBilledTicks(value: unknown): string | undefined {
	if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? String(value) : undefined;
	return typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value) ? value : undefined;
}

export function aggregateBilledCost(parts: CostPart[]): BilledCost | CostUnavailable {
	let total = 0n, reportedRequests = 0, requests = 0;
	let complete = true;
	for (const part of parts) {
		requests += part.requests;
		const ticks = readBilledTicks(part.ticks);
		if (ticks !== undefined) { total += BigInt(ticks); reportedRequests += part.reportedRequests; }
		complete &&= part.complete && ticks !== undefined;
	}
	if (!reportedRequests) return COST_UNAVAILABLE;
	const scale = 10_000_000_000n;
	return { available: true, kind: "billed", currency: "USD", ticks: total.toString(), usd: `${total / scale}.${(total % scale).toString().padStart(10, "0")}`, completeness: complete ? "complete" : "partial", reportedRequests, requests };
}

function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
/** Historical usage is an open host record; malformed or estimated costs cannot become billed amounts. */
export function storedCostPart(cost: unknown, requests: number): CostPart {
	const validCount = Number.isSafeInteger(requests) && requests >= 0;
	const expected = validCount ? requests : 0;
	if (record(cost) && cost.available === true && cost.kind === "billed" && cost.currency === "USD") {
		const ticks = readBilledTicks(cost.ticks);
		if (ticks !== undefined && typeof cost.reportedRequests === "number" && Number.isSafeInteger(cost.reportedRequests) && cost.reportedRequests > 0 && typeof cost.requests === "number" && Number.isSafeInteger(cost.requests) && cost.requests >= cost.reportedRequests) {
			return { ticks, reportedRequests: cost.reportedRequests, requests: Math.max(expected, cost.requests), complete: validCount && cost.completeness === "complete" && cost.reportedRequests === cost.requests && cost.requests === requests };
		}
	}
	return { requests: expected, reportedRequests: 0, complete: false };
}

export function billedCostForDisplay(cost: unknown) {
	const requests = record(cost) && typeof cost.requests === "number" ? cost.requests : 0;
	return aggregateBilledCost([storedCostPart(cost, requests)]);
}

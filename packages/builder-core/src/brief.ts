import { SCENARIO_IDS, type ScenarioId } from "./copy.ts";

/** Infer a scenario from author text. Returns null when the brief is ambiguous — do not invent. */
export function inferScenarioId(brief: string): ScenarioId | null {
	const text = brief.toLowerCase();
	const landing = /\blanding(?:\s+pages?)?\b/.test(text);
	const dashboard = /\bdashboard\b/.test(text);
	const website = /\bwebsites?\b/.test(text) || /\bweb site\b/.test(text);
	if (landing) return "landing";
	if (dashboard && !website) return "dashboard";
	if (website && !dashboard) return "website";
	if (dashboard) return "dashboard";
	return null;
}

export function isScenarioId(value: unknown): value is ScenarioId {
	return typeof value === "string" && (SCENARIO_IDS as readonly string[]).includes(value);
}

/**
 * Short page/hero title from a brief. Drops synthetic QA prefixes.
 * Does not invent a business name that is not in the text.
 */
export function displayTitleFromBrief(brief: string, fallback = "Draft page"): string {
	const trimmed = brief.trim();
	if (!trimmed) return fallback;
	const named = trimmed.match(/\bnamed\s+["']?([^"'.,\n]+)/i);
	if (named?.[1]) {
		const name = named[1].trim();
		if (name) return name.slice(0, 80);
	}
	const forMatch = trimmed.match(/\bfor\s+([^.,\n]+?)(?:,|\s+a\s+|\s+an\s+)/i);
	if (forMatch?.[1]) {
		const name = forMatch[1].replace(/\b(?:a|an|the)\s+new year\s+/i, "").trim();
		if (name && name.split(/\s+/).length <= 8) return name.slice(0, 80);
	}
	const withoutPrefix = trimmed
		.replace(/^qa\s+\w+(?:\s+\w+)?\s+\d{2,4}:\s*/i, "")
		.replace(/^(?:please\s+)?create\s+(?:a\s+)?(?:new year\s+)?/i, "")
		.trim();
	const first = (withoutPrefix.split(/[.!?]/)[0] ?? withoutPrefix).trim();
	return (first || trimmed).slice(0, 80) || fallback;
}

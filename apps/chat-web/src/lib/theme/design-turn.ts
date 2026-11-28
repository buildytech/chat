/**
 * Design-mode taste agent: a short JSON loop that proposes a brand brief and a magazine-theme v2 config.
 * The host validates each proposal and, on failure, returns issues for a retry (like write_page). It never
 * writes a Brand Skin itself. AgentMode stays ask|build; this loop is not a catalog tool turn.
 */
import { RADII, SKIN_IDS, THEME_FONT_IDS } from "./magazine/ids.ts";
import { HARMONIES } from "./magazine/palette.ts";
import { validateDesignProposal, type DesignProposal } from "./design-validate.ts";
import type { DesignIssue } from "./brand-brief.ts";

export type DesignChatMessage = { role: "system" | "user" | "assistant"; content: string };

type DesignComplete = (messages: readonly DesignChatMessage[], signal?: AbortSignal) => Promise<string>;

export const DESIGN_MAX_ATTEMPTS = 3;

export function designSystemPrompt(): string {
	const fonts = THEME_FONT_IDS.join(", ");
	const skins = SKIN_IDS.join(", ");
	const radii = RADII.join(", ");
	return [
		"You are the BuildY Design agent. You compose a unique brand style from taste and a brief: a brand thesis and a magazine-theme v2 config the page already knows how to wear.",
		"Work from one base registry skin, then choose palette, fonts and radius. Do not invent font families or a skin id outside the lists below. Do not use arbitrary px values.",
		"Answer with ONE JSON object only, no markdown fences, no commentary. Shape:",
		`{ "brief": { "name": "string", "thesis": { "summary": "string", "positioning": "string", "personality": ["string"], "antiPersonality": ["string"], "voice": { "tone": ["string"], "avoid": ["string"] } }, "grammar": { "styleDirection": "string", "shapeLanguage": { "core": "string" }, "imageTreatment": { "style": "string", "preferred": ["string"], "avoid": ["string"] }, "contentVoice": { "adjectives": ["string"], "avoid": ["string"] } } }, "theme": { "format": "magazine-theme", "version": 2, "mode": "light" or "dark", "skin": "<base skin or null>", "font": "<body font id or null>", "headingFont": "<heading font id or null>", "radius": <one of the radii or null>, "tokens": {}, "palette": { "harmony": "<${HARMONIES.join(" | ")}>", "h": 0-359, "s": 0-100, "l": 0-100 } } }`,
		"theme.tokens may add radius-*, density-* and shadow-* keys the magazine-theme v2 schema allows; omit keys you do not set. palette.contrast may be omitted (AA) or \"AAA\".",
		`Base skins (theme.skin): ${skins}, or null for the kit default.`,
		`Fonts (theme.font and theme.headingFont): ${fonts}, or null.`,
		`Radius (theme.radius), in px: ${radii}, or null.`,
		"Palette contrast must meet WCAG 2.2 AA: body text at least 4.5:1 on the background, primary foreground at least 3:1 on primary. Prefer a distinctive, specific brand, not a generic startup look.",
		"The brief must declare a name, a thesis summary, positioning, what the brand must not become (antiPersonality), a shape language, and image-treatment things to avoid.",
		"If the host returns issues, fix exactly those paths and send the full JSON again."
	].join("\n");
}

function issuesText(issues: DesignIssue[]): string {
	return issues.map((issue) => `${issue.path}: [${issue.code}] ${issue.message}`).join("\n");
}

/** Pull a JSON object out of a model reply (raw JSON, or a fenced / wrapped object). */
function parseDesignJson(text: string): unknown {
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		/* continue */
	}
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced) {
		try {
			return JSON.parse(fenced[1]!.trim());
		} catch {
			/* continue */
		}
	}
	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	if (start >= 0 && end > start) {
		try {
			return JSON.parse(trimmed.slice(start, end + 1));
		} catch {
			/* continue */
		}
	}
	return undefined;
}

type DesignTurnResult =
	| { ok: true; proposal: DesignProposal; attempts: number }
	| { ok: false; issues: DesignIssue[]; attempts: number; code?: string; message?: string };

/**
 * Run the Design loop: propose, validate, retry with issues, at most DESIGN_MAX_ATTEMPTS times.
 * `complete` talks to the host runtime; tests pass a fake.
 */

function errorCode(error: unknown): string {
	if (Boolean(error) && typeof error === "object" && "code" in error && typeof error.code === "string" && error.code) return error.code;
	return "design_failed";
}

export async function runDesignTurn(request: string, complete: DesignComplete, signal?: AbortSignal): Promise<DesignTurnResult> {
	const brief = request.trim();
	if (!brief) return { ok: false, issues: [{ code: "empty_request", path: "/", message: "Describe the brand, its audience and the feeling of the style." }], attempts: 0 };
	const messages: DesignChatMessage[] = [
		{ role: "system", content: designSystemPrompt() },
		{ role: "user", content: brief }
	];
	let lastIssues: DesignIssue[] = [];
	for (let attempt = 1; attempt <= DESIGN_MAX_ATTEMPTS; attempt += 1) {
		let text: string;
		try {
			text = await complete(messages, signal);
		} catch (error) {
			const aborted = signal?.aborted || (error instanceof Error && error.name === "AbortError");
			if (aborted) return { ok: false, issues: lastIssues, attempts: attempt, code: "aborted", message: "The design turn was cancelled." };
			const code = errorCode(error);
			const message = error instanceof Error && error.message.trim() ? error.message : "The design request could not be completed.";
			return { ok: false, issues: lastIssues, attempts: attempt, code, message };
		}
		const parsed = parseDesignJson(text);
		if (parsed === undefined) {
			lastIssues = [{ code: "not_json", path: "/", message: "Reply with one JSON object only, no commentary." }];
		} else {
			const checked = validateDesignProposal(parsed);
			if (checked.ok) return { ok: true, proposal: checked.proposal, attempts: attempt };
			lastIssues = checked.issues;
		}
		messages.push({ role: "assistant", content: text });
		messages.push({
			role: "user",
			content: `The host rejected the proposal (${lastIssues.length} issue(s)). Fix exactly these paths and send the full JSON again.\n${issuesText(lastIssues)}`
		});
	}
	return { ok: false, issues: lastIssues, attempts: DESIGN_MAX_ATTEMPTS, code: "invalid_proposal", message: "The proposal did not pass validation." };
}

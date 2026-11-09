import type { PageBlock } from "@buildytech/page-contract";
import { detectDemoDataRequest } from "./content.ts";

/**
 * Deterministic author-intent detectors for follow-up edits (host side, never the model).
 * Repo rule: no Cyrillic in code. Russian stems are \u escapes:
 * \u0441\u0430\u0439\u0434\u0431\u0430\u0440 sidebar, \u0431\u043e\u043a\u043e\u0432 side,
 * \u043f\u043e\u0434\u0432\u0430\u043b / \u0444\u0443\u0442\u0435\u0440 footer,
 * \u0431\u0435\u0437 without, \u0443\u0431\u0435\u0440 / \u0443\u0434\u0430\u043b remove,
 * \u0434\u0435\u043c\u043e demo, \u0444\u0435\u0439\u043a fake, \u0442\u0435\u0441\u0442\u043e\u0432 test,
 * \u0440\u0435\u0430\u043b\u044c\u043d real, \u0434\u0430\u043d\u043d data,
 * \u043d\u0438\u0436\u043d bottom, \u043c\u0435\u043d\u044e menu, \u043f\u0430\u043d\u0435\u043b panel.
 */

const RU_SIDEBAR = "(?:\u0441\u0430\u0439\u0434\u0431\u0430\u0440|\u0431\u043e\u043a\u043e\u0432\\S*\\s+(?:\u043f\u0430\u043d\u0435\u043b|\u043c\u0435\u043d\u044e|\u043d\u0430\u0432\u0438\u0433\u0430\u0446))";
const EN_SIDEBAR = "(?:side\\s?bar|side[\\s-]?nav(?:igation)?|side\\s+menu)";
const RU_FOOTER = "(?:\u043f\u043e\u0434\u0432\u0430\u043b|\u0444\u0443\u0442\u0435\u0440)";
const EN_FOOTER = "(?:footer|site\\s?map)";
const RU_BOTTOM = "(?:\u043d\u0438\u0436\u043d\\S*\\s+(?:\u043f\u0430\u043d\u0435\u043b|\u043c\u0435\u043d\u044e|\u043d\u0430\u0432\u0438\u0433\u0430\u0446))";
const EN_BOTTOM = "(?:bottom[\\s-]?(?:nav(?:igation)?|bar|tab\\s?bar|tabs)|tab\\s?bar)";
/** Explicit removal verbs always count. */
const RU_REMOVE = "(?:\u0443\u0431\u0435\u0440\\S*|\u0443\u0434\u0430\u043b\\S*|\u0441\u043a\u0440\u043e\u0439\\S*)";
const EN_REMOVE = "\\b(?:remove|drop|delete|hide)";
/** "no" / "without" count only when the author is not also asking to add something. */
const RU_WITHOUT = "(?:\u0431\u0435\u0437)";
const EN_WITHOUT = "\\b(?:no|without)";

function mentions(text: string, en: string, ru: string): boolean {
	return new RegExp(`${en}|${ru}`, "iu").test(text);
}

/** "There is no sidebar, add one" / "\u043d\u0435\u0442\u0443 ... \u0434\u043e\u0431\u0430\u0432\u044c" is a request, not a removal. */
const ADD_INTENT = /\b(?:add|include|need|want|put|show|bring back|restore)\b|\u0434\u043e\u0431\u0430\u0432|\u043d\u0443\u0436\u0435\u043d|\u0432\u0435\u0440\u043d\u0438/iu;

function near(neg: string, target: string): string {
	return `${neg}(?:\\s+\\S+){0,2}\\s+${target}`;
}

function negated(text: string, en: string, ru: string): boolean {
	if (new RegExp(`${near(EN_REMOVE, en)}|${near(RU_REMOVE, ru)}`, "iu").test(text)) return true;
	if (ADD_INTENT.test(text)) return false;
	return new RegExp(`${near(EN_WITHOUT, en)}|${near(RU_WITHOUT, ru)}`, "iu").test(text);
}

/** Author asks for a sidebar (and did not ask to remove it). */
export function detectSidebarRequest(text: string): boolean {
	return mentions(text, EN_SIDEBAR, RU_SIDEBAR) && !negated(text, EN_SIDEBAR, RU_SIDEBAR);
}

export function detectSidebarRemoval(text: string): boolean {
	return negated(text, EN_SIDEBAR, RU_SIDEBAR);
}

export function detectBottomNavRemoval(text: string): boolean {
	return negated(text, EN_BOTTOM, RU_BOTTOM);
}

/** Footer / sitemap explicitly requested. Dashboards omit the marketing sitemap footer otherwise. */
export function detectFooterRequest(text: string): boolean {
	return mentions(text, EN_FOOTER, RU_FOOTER) && !negated(text, EN_FOOTER, RU_FOOTER);
}

export function detectFooterRemoval(text: string): boolean {
	return negated(text, EN_FOOTER, RU_FOOTER);
}

/** Author turns demo data off ("no demo data", "real data only"). */
export function detectDemoOptOut(text: string): boolean {
	const en = /\b(?:no|without|remove|drop|delete|hide)\s+(?:the\s+)?(?:demo|fake|sample|mock|dummy|test)\b|\breal\s+(?:data|figures|numbers)\b/i;
	const ru = new RegExp(
		`(?:${RU_REMOVE}|${RU_WITHOUT})(?:\\s+\\S+){0,1}\\s+(?:\u0434\u0435\u043c\u043e|\u0444\u0435\u0439\u043a|\u0442\u0435\u0441\u0442\u043e\u0432)|\u0440\u0435\u0430\u043b\u044c\u043d\\S*\\s+\u0434\u0430\u043d\u043d`,
		"iu"
	);
	return en.test(text) || ru.test(text);
}

const YEAR = /(?:\u00a9|\(c\)|copyright)?\s*\b(?:19|20)\d{2}\b(?:\s*[-\u2013]\s*(?:19|20)\d{2}\b)?/gi;

/**
 * Footer facts the author never gave are not invented: strip years (and the copyright
 * sign attached to them) from footer legal/contact unless the year appears in the brief.
 */
export function stripInventedFooterYears(
	blocks: PageBlock[],
	authorText: string
): { blocks: PageBlock[]; stripped: string[] } {
	const stripped: string[] = [];
	const allowed = new Set((authorText.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(String));
	const next = blocks.map((node) => {
		if (node.kind !== "footer" || !node.copy) return node;
		const copy = { ...node.copy };
		let touched = false;
		for (const field of ["legal", "contact"] as const) {
			const value = copy[field];
			if (typeof value !== "string") continue;
			const cleaned = value
				.replace(YEAR, (match) => {
					const years = match.match(/(?:19|20)\d{2}/g) ?? [];
					if (years.length && years.every((y) => allowed.has(y))) return match;
					stripped.push(`${node.kind}.${field}`);
					touched = true;
					return " ";
				})
				.replace(/\s*\u00a9\s*(?=[.,;]|$)/g, "")
				.replace(/^\s*[.,;:\-\u2013\u00b7|]+\s*/, "")
				.replace(/\s{2,}/g, " ")
				.trim();
			if (cleaned) copy[field] = cleaned;
			else delete copy[field];
		}
		return touched ? { ...node, copy } : node;
	});
	return { blocks: next, stripped: [...new Set(stripped)] };
}

/**
 * Sticky demo-data flag for a chat: the latest explicit author request wins
 * (a demo request turns it on, an opt-out turns it off). Reads author messages only.
 */
export function sessionDemoFlag(authorMessages: string[]): boolean {
	let on = false;
	for (const text of authorMessages) {
		if (detectDemoOptOut(text)) on = false;
		else if (detectDemoDataRequest(text)) on = true;
	}
	return on;
}

// Copy edits beyond the app shell: rename, rewrite, change, fill, translate...
const EN_COPY_EDIT = /\b(?:rename|rewrite|reword|change|edit|update|replace|translate|fill|shorten|call (?:it|them)|title|text|copy|heading)\b/i;
const RU_COPY_EDIT = /(?:\u043f\u0435\u0440\u0435\u0438\u043c\u0435\u043d|\u043f\u0435\u0440\u0435\u043f\u0438\u0448|\u0438\u0437\u043c\u0435\u043d|\u0437\u0430\u043c\u0435\u043d|\u043e\u0431\u043d\u043e\u0432|\u043f\u0435\u0440\u0435\u0432\u0435\u0434|\u043f\u0435\u0440\u0435\u0432\u0435\u0434\u0438|\u0437\u0430\u043f\u043e\u043b\u043d|\u043d\u0430\u0437\u043e\u0432|\u043f\u043e\u043c\u0435\u043d\u044f|\u0438\u0441\u043f\u0440\u0430\u0432|\u0441\u043e\u043a\u0440\u0430\u0442\u0438|\u0442\u0435\u043a\u0441\u0442|\u0437\u0430\u0433\u043e\u043b\u043e\u0432)/iu;

/** True when the author asks to change wording or data, not only to add/remove shell blocks. */
export function detectCopyEditIntent(text: string): boolean {
	return EN_COPY_EDIT.test(text) || RU_COPY_EDIT.test(text);
}

/** A turn that only adds or removes app-shell blocks (sidebar, bottom nav, footer). */
export function isShellOnlyRequest(text: string): boolean {
	const shell =
		detectSidebarRequest(text) || detectSidebarRemoval(text) || detectBottomNavRemoval(text) || detectFooterRequest(text) || detectFooterRemoval(text);
	return shell && !detectCopyEditIntent(text) && !detectDemoOptOut(text);
}

/**
 * Host validator for a Design proposal: a brand brief plus a magazine-theme v2 config.
 * Writes nothing; the caller stores a Brand Skin only when this returns no issues.
 */
import { briefCompletenessIssues, parseBrandBrief, toBrandContract, type BrandBrief, type DesignIssue } from "./brand-brief.ts";
import { contrastRatio, MIN_BODY_AA, MIN_LARGE_AA } from "./brand-os-color.ts";
import { importThemeConfig, renderCustomSkin, type ThemeConfig } from "./custom-skin.ts";
import { themeFamily } from "./magazine/ids.ts";

export type DesignProposal = { brief: BrandBrief; theme: ThemeConfig; contract: Record<string, unknown> };

function formatRatio(value: number | null): string {
	return value === null ? "n/a" : `${value.toFixed(2)}:1`;
}

function styleMap(theme: ThemeConfig): Record<string, string> {
	return Object.fromEntries(renderCustomSkin(theme).style.map(([prop, value]) => [prop.trim(), value.trim()]));
}

function token(style: Record<string, string>, name: string): string {
	return style[name] ?? "";
}

/** WCAG 2.2 AA checks on the theme's computed root colours (body text and primary pair). */
export function themeContrastIssues(theme: ThemeConfig): DesignIssue[] {
	const style = styleMap(theme);
	const issues: DesignIssue[] = [];
	const body = contrastRatio(token(style, "--foreground"), token(style, "--background"));
	if (body === null) {
		issues.push({ code: "unparsable_contrast", path: "/theme/palette", message: "Body text contrast colours could not be parsed." });
	} else if (body < MIN_BODY_AA) {
		issues.push({
			code: "contrast_body",
			path: "/theme/palette",
			message: `Body text contrast ${formatRatio(body)} is below WCAG 2.2 AA ${MIN_BODY_AA}:1.`
		});
	}
	const primary = contrastRatio(token(style, "--primary-foreground"), token(style, "--primary"));
	if (token(style, "--primary") && token(style, "--primary-foreground")) {
		if (primary === null) {
			issues.push({ code: "unparsable_contrast", path: "/theme/palette", message: "Primary contrast colours could not be parsed." });
		} else if (primary < MIN_LARGE_AA) {
			issues.push({
				code: "contrast_primary",
				path: "/theme/palette",
				message: `Primary-on-primary contrast ${formatRatio(primary)} is below WCAG 2.2 AA large-text ${MIN_LARGE_AA}:1.`
			});
		}
	}
	return issues;
}

function contractTokens(theme: ThemeConfig): { color: Record<string, string>; fonts: { display: string; body: string }; radius: string } {
	const style = styleMap(theme);
	const color: Record<string, string> = {};
	for (const key of ["background", "foreground", "card", "primary", "primary-foreground", "accent", "border", "destructive"]) {
		const value = token(style, `--${key}`);
		if (value) color[key === "primary-foreground" ? "primaryForeground" : key] = value;
	}
	const body = theme.font ? themeFamily(theme.font) : "sans-serif";
	const display = theme.headingFont ? themeFamily(theme.headingFont) : body;
	return { color, fonts: { display, body }, radius: token(style, "--radius") || "8px" };
}

/** Validate a parsed proposal (or raw JSON). On failure returns issues and does not yield a proposal. */
export function validateDesignProposal(input: unknown): { ok: true; proposal: DesignProposal } | { ok: false; issues: DesignIssue[] } {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		return { ok: false, issues: [{ code: "invalid_root", path: "/", message: "Expected a JSON object with brief and theme." }] };
	}
	const record: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) record[key] = value;
	const briefPart = record.brief ?? record;
	const themePart = record.theme ?? record.config;
	const briefRead = parseBrandBrief(briefPart);
	const themeRead = importThemeConfig(themePart);
	const issues: DesignIssue[] = [];
	if (!briefRead.ok) issues.push(...briefRead.issues);
	if (!themeRead.ok) {
		issues.push(
			...themeRead.issues.map((issue) => ({
				code: issue.code,
				path: issue.path ? `/theme${issue.path}` : "/theme",
				message: issue.allowed?.length ? `${issue.code} (${issue.path || "/"}): ${issue.allowed.join(", ")}` : issue.code
			}))
		);
	}
	if (issues.length) return { ok: false, issues };
	const brief = briefRead.ok ? briefRead.brief : null;
	const theme = themeRead.ok ? themeRead.config : null;
	if (!brief || !theme) return { ok: false, issues };
	issues.push(...briefCompletenessIssues(brief), ...themeContrastIssues(theme));
	if (issues.length) return { ok: false, issues };
	return { ok: true, proposal: { brief, theme, contract: toBrandContract(brief, contractTokens(theme)) } };
}

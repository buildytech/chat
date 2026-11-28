/**
 * Host validator for a Design proposal: a brand brief plus a magazine-theme v2 config.
 * Writes nothing; the caller stores a Brand Skin only when this returns no issues.
 */
import { briefCompletenessIssues, parseBrandBrief, toBrandContract, type BrandBrief, type DesignIssue } from "./brand-brief.ts";
import { contrastRatio, MIN_BODY_AA, MIN_LARGE_AA } from "./brand-os-color.ts";
import { importThemeConfig, renderCustomSkin, SKIN_MODES, type CustomSkinRender, type ThemeConfig } from "./custom-skin.ts";
import type { Mode } from "./magazine/global-theme.ts";
import { themeFamily } from "./magazine/ids.ts";

export type DesignProposal = { brief: BrandBrief; theme: ThemeConfig; contract: Record<string, unknown> };

function formatRatio(value: number | null): string {
	return value === null ? "n/a" : `${value.toFixed(2)}:1`;
}

type ModeColors = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

/** The computed root colours of one mode (the palette rendered light or dark over the base skin). */
function modeStyle(render: CustomSkinRender, mode: Mode): Record<string, string> {
	return Object.fromEntries(render.modes[mode].map(([prop, value]) => [prop.trim(), value.trim()]));
}

function token(style: Record<string, string>, name: string): string {
	return style[name] ?? "";
}

/** Colour tokens every mode must carry for a Brand Skin to be complete (ADR 0072). */
const REQUIRED_MODE_TOKENS = ["background", "foreground", "card", "primary", "primaryForeground", "accent", "border"] as const;

/** WCAG 2.2 AA checks of one mode: body text on the background and the primary pair. */
function modeContrastIssues(render: CustomSkinRender, mode: Mode): DesignIssue[] {
	const style = modeStyle(render, mode);
	const issues: DesignIssue[] = [];
	const body = contrastRatio(token(style, "--foreground"), token(style, "--background"));
	if (body === null) {
		issues.push({ code: "unparsable_contrast", path: "/theme/palette", message: `Body text contrast colours could not be parsed in ${mode} mode.` });
	} else if (body < MIN_BODY_AA) {
		issues.push({
			code: "contrast_body",
			path: "/theme/palette",
			message: `Body text contrast ${formatRatio(body)} in ${mode} mode is below WCAG 2.2 AA ${MIN_BODY_AA}:1.`
		});
	}
	const primary = contrastRatio(token(style, "--primary-foreground"), token(style, "--primary"));
	if (token(style, "--primary") && token(style, "--primary-foreground")) {
		if (primary === null) {
			issues.push({ code: "unparsable_contrast", path: "/theme/palette", message: `Primary contrast colours could not be parsed in ${mode} mode.` });
		} else if (primary < MIN_LARGE_AA) {
			issues.push({
				code: "contrast_primary",
				path: "/theme/palette",
				message: `Primary-on-primary contrast ${formatRatio(primary)} in ${mode} mode is below WCAG 2.2 AA large-text ${MIN_LARGE_AA}:1.`
			});
		}
	}
	return issues;
}

/** WCAG 2.2 AA in both modes: a skin that passes only in one of light and dark is rejected. */
export function themeContrastIssues(theme: ThemeConfig, render: CustomSkinRender = renderCustomSkin(theme)): DesignIssue[] {
	if (!theme.palette) {
		return [{ code: "missing_palette", path: "/theme/palette", message: "A Brand Skin needs a palette: its light and dark colour sets are both computed from it." }];
	}
	return SKIN_MODES.flatMap((mode) => modeContrastIssues(render, mode));
}

/** The colour tokens of a mode in the brand contract's names (background, primaryForeground, ...). */
function modeColors(render: CustomSkinRender, mode: Mode): ModeColors {
	const style = modeStyle(render, mode);
	const color: ModeColors = {};
	for (const key of ["background", "foreground", "card", "primary", "primary-foreground", "accent", "border", "destructive"]) {
		const value = token(style, `--${key}`);
		if (value) color[key === "primary-foreground" ? "primaryForeground" : key] = value;
	}
	return color;
}

/**
 * The contract's colour tokens must carry both modes, each with the required keys. Applied to every proposal and to
 * every edited skin: a skin with an empty or partial light or dark set is rejected (never stored half-finished).
 */
export function modeCompletenessIssues(color: unknown): DesignIssue[] {
	const issues: DesignIssue[] = [];
	const record = isRecord(color) ? color : {};
	for (const mode of SKIN_MODES) {
		const set = record[mode];
		const colors = isRecord(set) ? set : null;
		if (!colors || Object.keys(colors).length === 0) {
			issues.push({ code: "missing_mode", path: `/contract/tokens/color/${mode}`, message: `The ${mode} mode has no colour tokens: every Brand Skin carries both light and dark.` });
			continue;
		}
		for (const key of REQUIRED_MODE_TOKENS) {
			if (typeof colors[key] !== "string" || !colors[key]) {
				issues.push({ code: "missing_mode_token", path: `/contract/tokens/color/${mode}/${key}`, message: `The ${mode} mode has no ${key} token.` });
			}
		}
	}
	return issues;
}

function contractTokens(theme: ThemeConfig): { color: { light: ModeColors; dark: ModeColors }; fonts: { display: string; body: string }; radius: string } {
	const body = theme.font ? themeFamily(theme.font) : "sans-serif";
	const display = theme.headingFont ? themeFamily(theme.headingFont) : body;
	const render = renderCustomSkin(theme);
	return { color: { light: modeColors(render, "light"), dark: modeColors(render, "dark") }, fonts: { display, body }, radius: theme.radius !== null ? `${theme.radius}px` : "8px" };
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
	const contract = toBrandContract(brief, contractTokens(theme));
	const tokens = contract.tokens;
	issues.push(...modeCompletenessIssues(tokens && typeof tokens === "object" ? Reflect.get(tokens, "color") : undefined));
	if (issues.length) return { ok: false, issues };
	return { ok: true, proposal: { brief, theme, contract } };
}

/**
 * Custom Skin (ADR 0025): one theme imported in Settings as the Stock theme editor exports it (codegen-x/ui8kit
 * app.codegen-x.com Stock, Theme > Export / import: format `magazine-theme`, version 2, every setting). The chat keeps
 * one slot; a new import replaces it. Preview and ZIP render it the way Stock renders the same config on its root:
 * the base skin `theme-<skin>` (same CSS as Stock's), `data-skin` and the density attributes, the inline variables of
 * `rootStyle` (radius, fonts, per-element tokens, the custom palette for the config's mode, the type scale), the
 * config's light / dark mode, and the Google fonts the skin and the theme fonts name. It applies to the preview
 * document and the exported site only, never to the chat UI. Pure: no DOM, no storage (custom-skin.svelte.ts keeps it).
 */
import { CONFIG_FORMAT, CONFIG_VERSION, fromConfig, rootAttrs, rootStyle, THEME_SCHEMA, toConfig, type Mode, type ThemeConfig } from "./magazine/global-theme.ts";
import { SKIN_FONTS, themeFamily, themeFontSpec } from "./magazine/ids.ts";
import { paletteTokens } from "./magazine/palette.ts";

export { CONFIG_FORMAT, CONFIG_VERSION, type ThemeConfig };

/** The value of the chat's skin selector (session `skin`) that means "the imported theme". */
export const CUSTOM_SKIN_ID = "custom";

type ThemeIssueCode = "not_json" | "not_object" | "format" | "version" | "unknown_key" | "invalid_value" | "required" | "not_kept";
/** One reason an input is not a magazine-theme v2 config: `path` is a JSON Pointer (`/tokens/radius-card`). */
export type ThemeIssue = { code: ThemeIssueCode; path: string; allowed?: string[] };
export type ThemeImport = { ok: true; config: ThemeConfig; text: string } | { ok: false; issues: ThemeIssue[] };

type SchemaNode = {
	const?: unknown;
	enum?: readonly unknown[];
	type?: string | readonly string[];
	minimum?: number;
	maximum?: number;
	required?: readonly string[];
	additionalProperties?: boolean;
	properties?: Record<string, SchemaNode>;
};

const shown = (value: unknown): string => (value === null ? "null" : typeof value === "string" ? value : JSON.stringify(value));

function typeOk(value: unknown, type: string): boolean {
	switch (type) {
		case "object":
			return !!value && typeof value === "object" && !Array.isArray(value);
		case "null":
			return value === null;
		case "integer":
			return typeof value === "number" && Number.isInteger(value);
		case "number":
			return typeof value === "number" && Number.isFinite(value);
		default:
			return typeof value === type;
	}
}

/** Checks a value against the subset of JSON Schema THEME_SCHEMA uses (const, enum, type, minimum, maximum, objects). */
function check(node: SchemaNode, value: unknown, path: string, out: ThemeIssue[]): void {
	if (node.const !== undefined && value !== node.const) {
		out.push({ code: path === "/format" ? "format" : path === "/version" ? "version" : "invalid_value", path, allowed: [shown(node.const)] });
		return;
	}
	if (node.enum && !node.enum.some((entry) => entry === value)) {
		out.push({ code: "invalid_value", path, allowed: node.enum.map(shown) });
		return;
	}
	if (node.type) {
		const types = typeof node.type === "string" ? [node.type] : node.type;
		if (!types.some((type) => typeOk(value, type))) {
			out.push({ code: "invalid_value", path, allowed: [...types] });
			return;
		}
	}
	if (typeof value === "number" && ((node.minimum !== undefined && value < node.minimum) || (node.maximum !== undefined && value > node.maximum))) {
		out.push({ code: "invalid_value", path, allowed: [`${node.minimum ?? "-"}..${node.maximum ?? "-"}`] });
		return;
	}
	if (!value || typeof value !== "object" || Array.isArray(value) || !node.properties) return;
	const record = value as Record<string, unknown>;
	for (const key of node.required ?? []) if (!(key in record)) out.push({ code: "required", path: `${path}/${key}` });
	for (const [key, entry] of Object.entries(record)) {
		const child = node.properties[key];
		if (!child) {
			if (node.additionalProperties === false) out.push({ code: "unknown_key", path: `${path}/${key}` });
			continue;
		}
		check(child, entry, `${path}/${key}`, out);
	}
}

/** The canonical text of a config: what Stock's Export writes (JSON.stringify(config, null, 2)). */
export const configText = (config: ThemeConfig): string => JSON.stringify(config, null, 2);

/**
 * Import exactly a magazine-theme v2 config (JSON text or a parsed value). The input is checked against Stock's own
 * THEME_SCHEMA (unknown keys, values outside the lists, ranges); then Stock's fromConfig reads it. A value Stock would
 * drop on import (e.g. a width the chosen font has no axis for) is an issue too: the slot never keeps less than the
 * file says, so Export gives the same config back.
 */
export function importThemeConfig(input: unknown): ThemeImport {
	let value = input;
	if (typeof value === "string") {
		try {
			value = JSON.parse(value);
		} catch {
			return { ok: false, issues: [{ code: "not_json", path: "" }] };
		}
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, issues: [{ code: "not_object", path: "" }] };
	const record = value as Record<string, unknown>;
	if (record.format !== CONFIG_FORMAT) return { ok: false, issues: [{ code: "format", path: "/format", allowed: [CONFIG_FORMAT] }] };
	if (record.version !== CONFIG_VERSION) return { ok: false, issues: [{ code: "version", path: "/version", allowed: [String(CONFIG_VERSION)] }] };
	const issues: ThemeIssue[] = [];
	check(THEME_SCHEMA as unknown as SchemaNode, value, "", issues);
	if (issues.length) return { ok: false, issues };
	const read = fromConfig(value);
	if (!read.ok) return { ok: false, issues: [{ code: "not_object", path: "" }] };
	if (read.dropped.length) return { ok: false, issues: read.dropped.map((key) => ({ code: "not_kept" as const, path: key.includes("-") ? `/tokens/${key}` : `/${key}` })) };
	const config = toConfig({ mode: read.mode ?? "light", theme: read.theme });
	return { ok: true, config, text: configText(config) };
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/**
 * Import what the Stock / Magazine theme editor (codegen-x/ui8kit packages/theme-model) can hand over: its Export (format
 * `magazine-theme` v2, read as it is), and the older shapes its own `fromConfig` reads: the stored `{ v: 1, theme }`, a bare
 * theme object without a format, and a style preset (format 1: skin, font, radius, tokens). The older shapes are read by that
 * reader and written as v2 (an import replaces the theme: fields not in the input are unset), then pass the same strict check
 * as a v2 file. A value the reader would drop is an issue (`not_kept`), never silently lost.
 */
export function importStockExport(input: unknown): ThemeImport {
	let value = input;
	if (typeof value === "string") {
		try {
			value = JSON.parse(value);
		} catch {
			return { ok: false, issues: [{ code: "not_json", path: "" }] };
		}
	}
	if (!isPlainObject(value)) return { ok: false, issues: [{ code: "not_object", path: "" }] };
	const record = value;
	const stored = record.v === 1 && !!record.theme && typeof record.theme === "object";
	if (record.format !== undefined && record.format !== 1 && !stored) return importThemeConfig(value);
	const read = fromConfig(record);
	if (!read.ok) return { ok: false, issues: [{ code: "not_object", path: "" }] };
	if (read.dropped.length) return { ok: false, issues: read.dropped.map((key) => ({ code: "not_kept" as const, path: key.includes("-") ? `/tokens/${key}` : `/${key}` })) };
	return importThemeConfig(toConfig({ mode: read.mode ?? "light", theme: read.theme }));
}

/** The two modes every Brand Skin carries (ADR 0072). */
export const SKIN_MODES = ["light", "dark"] as const;

/** What the preview document and the exported site carry for a config (Stock's applyState, as data). */
export type CustomSkinRender = {
	/** the base skin (registry item theme-<skin>), null: the kit's default theme */
	skin: string | null;
	/** the config's own default mode (Stock exports it); both modes are rendered, the app's light / dark choice picks one */
	mode: Mode;
	/** data-skin and the density attributes (rootAttrs) */
	attrs: Record<string, string>;
	/** the inline declarations of the root that do not depend on the mode: radius, fonts, per-element tokens, type scale */
	style: Array<[string, string]>;
	/** the palette's colour tokens and `color-scheme` for each mode (the same palette, computed light and dark) */
	modes: Record<Mode, Array<[string, string]>>;
	/** Google Fonts css2 stylesheet URLs: the skin's fonts, then the theme fonts */
	fonts: string[];
};

/**
 * The two base rules Stock's own CSS adds under every themed render (codegen-x/ui8kit apps/stock/src/app.css): body text
 * reads the type scale (the Theme's font size % rewrites --text-*), and h1-h3 take the theme's heading font and weight.
 * Without them a heading font or a font size % would not show; the preview and the ZIP carry them with the Custom Skin.
 */
export const CUSTOM_SKIN_BASE_CSS = `/* Custom Skin base rules, as Stock's app.css: body text on the type scale, h1-h3 in the theme's heading font. */
@layer base {
  body { font-size: var(--text-base); line-height: var(--tw-leading, var(--text-base--line-height)); }
  :is(h1, h2, h3) { font-family: var(--taste-heading, var(--font-sans)); font-weight: var(--taste-heading-weight, var(--font-weight-semibold, 600)); }
}
`;

const googleFontUrl = (spec: string): string => `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;

const pair = (prop: string, value: string): [string, string] => [prop, value];

function declarations(text: string): Array<[string, string]> {
	return text
		.split(";")
		.filter(Boolean)
		.map((decl) => {
			const at = decl.indexOf(":");
			return pair(decl.slice(0, at), decl.slice(at + 1));
		});
}

export function renderCustomSkin(config: ThemeConfig): CustomSkinRender {
	const read = fromConfig(config);
	if (!read.ok) throw new Error(`not a magazine-theme config: ${read.error}`);
	const theme = read.theme;
	const mode: Mode = read.mode ?? "light";
	const { palette, ...plain } = theme;
	const style = declarations(rootStyle({ ...plain }, themeFamily, "light"));
	const forMode = (which: Mode): Array<[string, string]> => [
		...(palette ? Object.entries(paletteTokens(palette, which, theme.skin)).map(([prop, value]) => pair(`--${prop}`, value)) : []),
		pair("color-scheme", which)
	];
	const specs = [...(theme.skin ? (SKIN_FONTS[theme.skin] ?? []) : []), ...[theme.font, theme.headingFont].flatMap((id) => (id ? [themeFontSpec(id)].filter((s): s is string => !!s) : []))];
	return { skin: theme.skin, mode, attrs: rootAttrs(theme), style, modes: { light: forMode("light"), dark: forMode("dark") }, fonts: [...new Set(specs)].map(googleFontUrl) };
}

/** Where a mode's rules go: selectors that outrank the skin's own `[data-skin]` rules (so the palette wins in both modes). */
type ModeSelectors = { light: string; dark: string };
/** The whole document (preview frame, exported site): light on the root, dark under `.dark` or `data-theme="dark"`. */
export const ROOT_MODE_SELECTORS: ModeSelectors = { light: ":root:root", dark: ':root:root:is(.dark, [data-theme="dark"])' };
/** A scope element inside the app (the Blocks feed): dark when the scope or an ancestor is dark. */
export const SCOPE_MODE_SELECTORS: ModeSelectors = {
	light: "[data-page-skin][data-page-skin]",
	dark: ':is(.dark, [data-theme="dark"]) [data-page-skin][data-page-skin], [data-page-skin][data-page-skin]:is(.dark, [data-theme="dark"])'
};

/** The palette of a render as one rule per mode: both token sets are always written (light, then dark). */
export function modeCss(render: CustomSkinRender, selectors: ModeSelectors = ROOT_MODE_SELECTORS): string {
	const rule = (selector: string, decls: Array<[string, string]>): string => `${selector} {\n${decls.map(([prop, value]) => `  ${prop.trim()}: ${value.trim()};`).join("\n")}\n}`;
	return `${rule(selectors.light, render.modes.light)}\n${rule(selectors.dark, render.modes.dark)}\n`;
}

/** The inline `style` attribute text of the mode-independent declarations of a render. */
export const renderStyleText = (render: CustomSkinRender): string => render.style.map(([prop, value]) => `${prop}:${value}`).join(";");

/** The stored slot `{ v: 1, config }`; null when absent or not a valid config (the caller quarantines a bad value). */
export function parseCustomSkinSlot(raw: string | null): { config: ThemeConfig } | { error: string } | null {
	if (raw == null) return null;
	try {
		const parsed = JSON.parse(raw) as { v?: unknown; config?: unknown };
		if (parsed?.v !== 1) return { error: "custom_skin_version" };
		const read = importThemeConfig(parsed.config);
		return read.ok ? { config: read.config } : { error: `custom_skin_invalid ${read.issues[0]?.code ?? ""} ${read.issues[0]?.path ?? ""}`.trim() };
	} catch {
		return { error: "custom_skin_corrupt" };
	}
}

export const serializeCustomSkinSlot = (config: ThemeConfig): string => JSON.stringify({ v: 1, config });

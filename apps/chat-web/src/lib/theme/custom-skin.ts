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

export { CONFIG_FORMAT, CONFIG_VERSION, type ThemeConfig };

/** The value of the chat's skin selector (session `skin`) that means "the imported theme". */
export const CUSTOM_SKIN_ID = "custom";

export type ThemeIssueCode = "not_json" | "not_object" | "format" | "version" | "unknown_key" | "invalid_value" | "required" | "not_kept";
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

/** What the preview document and the exported index.html carry for a config (Stock's applyState, as data). */
export type CustomSkinRender = {
	/** the base skin (registry item theme-<skin>), null: the kit's default theme */
	skin: string | null;
	mode: Mode;
	/** data-skin and the density attributes (rootAttrs) */
	attrs: Record<string, string>;
	/** the inline declarations of the root, in Stock's order (rootStyle for the config's mode), then color-scheme */
	style: Array<[string, string]>;
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

export const googleFontUrl = (spec: string): string => `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;

export function renderCustomSkin(config: ThemeConfig): CustomSkinRender {
	const read = fromConfig(config);
	if (!read.ok) throw new Error(`not a magazine-theme config: ${read.error}`);
	const theme = read.theme;
	const mode: Mode = read.mode ?? "light";
	const style: Array<[string, string]> = rootStyle(theme, themeFamily, mode)
		.split(";")
		.filter(Boolean)
		.map((decl) => {
			const at = decl.indexOf(":");
			return [decl.slice(0, at), decl.slice(at + 1)] as [string, string];
		});
	style.push(["color-scheme", mode]);
	const specs = [...(theme.skin ? (SKIN_FONTS[theme.skin] ?? []) : []), ...[theme.font, theme.headingFont].flatMap((id) => (id ? [themeFontSpec(id)].filter((s): s is string => !!s) : []))];
	return { skin: theme.skin, mode, attrs: rootAttrs(theme), style, fonts: [...new Set(specs)].map(googleFontUrl) };
}

/** The inline `style` attribute text of a render (index.html of the ZIP). */
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

/**
 * Brand Skins carry both modes and Design edits a skin in place (ADR 0072). Pure: no provider keys, no DOM.
 * Regression for the owner's session: TITAN came out dark only, "Lumen" light only, and every request made a new skin.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	editedBrandSkin,
	revisionOf,
	sameBrandSkinContent,
	upsertBrandSkin,
	brandSkinsOf,
	designExtOf,
	type BrandSkinRecord
} from "../../apps/chat-web/src/lib/theme/brand-skins.ts";
import { importThemeConfig, modeCss, renderCustomSkin, ROOT_MODE_SELECTORS, SCOPE_MODE_SELECTORS, type ThemeConfig } from "../../apps/chat-web/src/lib/theme/custom-skin.ts";
import { modeCompletenessIssues, themeContrastIssues, validateDesignProposal } from "../../apps/chat-web/src/lib/theme/design-validate.ts";
import { designSystemPrompt, runDesignTurn, type DesignBase, type DesignChatMessage } from "../../apps/chat-web/src/lib/theme/design-turn.ts";
import type { Project } from "../../apps/chat-web/src/lib/project/types.ts";

const STOCK = readFileSync(new URL("./fixtures/stock-theme-export.json", import.meta.url), "utf8");

function config(over: Partial<ThemeConfig> = {}): ThemeConfig {
	const r = importThemeConfig(STOCK);
	assert.ok(r.ok);
	return { ...r.config, ...over };
}

function brief(name = "TITAN") {
	return {
		name,
		thesis: {
			summary: "A deep-tech platform: confident controls, soft glow.",
			positioning: "Serious infrastructure for ambitious teams.",
			antiPersonality: ["generic SaaS"]
		},
		grammar: { shapeLanguage: { core: "large soft controls" }, imageTreatment: { avoid: ["stock photos"] } }
	};
}

const owner = (palette: ThemeConfig["palette"], mode: ThemeConfig["mode"]): ThemeConfig => config({ mode, palette, skin: "cosmic-night" });

test("the Design prompt asks for both modes and AA in both, and never calls one of them unsupported", () => {
	const prompt = designSystemPrompt();
	assert.match(prompt, /BOTH a light and a dark mode/);
	assert.match(prompt, /AA in light mode AND in dark mode/);
	assert.match(prompt, /never design for one mode only/);
	assert.doesNotMatch(prompt, /EDIT MODE/, "a new skin has no edit block");
});

test("a dark-default skin (the owner's TITAN) renders a light set and a dark set; so does a light-default one (Lumen)", () => {
	for (const mode of ["dark", "light"] as const) {
		const render = renderCustomSkin(owner({ harmony: "analogous", h: 210, s: 75, l: 14, contrast: "AAA" }, mode));
		const light = Object.fromEntries(render.modes.light);
		const dark = Object.fromEntries(render.modes.dark);
		for (const key of ["--background", "--foreground", "--primary", "--primary-foreground", "--card", "--border"]) {
			assert.ok(light[key] && dark[key], `${mode}-default: ${key} in both modes`);
		}
		assert.notEqual(light["--background"], dark["--background"], `${mode}-default: the two modes differ`);
		assert.equal(light["color-scheme"], "light");
		assert.equal(dark["color-scheme"], "dark");
		assert.equal(render.style.some(([prop]) => prop.startsWith("--primary") || prop === "color-scheme"), false, "no palette and no fixed colour-scheme inline on the root");
	}
});

test("the rendered rules write both modes with selectors that outrank the skin's own", () => {
	const render = renderCustomSkin(owner({ harmony: "split", h: 24, s: 92, l: 58 }, "dark"));
	const css = modeCss(render);
	assert.ok(css.includes(`${ROOT_MODE_SELECTORS.light} {`) && css.includes(`${ROOT_MODE_SELECTORS.dark} {`));
	assert.ok(css.indexOf(ROOT_MODE_SELECTORS.light) < css.indexOf(ROOT_MODE_SELECTORS.dark), "light first, dark after");
	assert.equal((css.match(/--primary:/g) ?? []).length, 2);
	const scoped = modeCss(render, SCOPE_MODE_SELECTORS);
	assert.match(scoped, /\[data-page-skin\]\[data-page-skin\] \{/);
	assert.match(scoped, /:is\(\.dark, \[data-theme="dark"\]\) \[data-page-skin\]\[data-page-skin\], \[data-page-skin\]\[data-page-skin\]:is\(\.dark, \[data-theme="dark"\]\) \{/);
});

test("validate: the contract carries light AND dark colour sets (dark is no longer empty), and both pass AA", () => {
	for (const mode of ["dark", "light"] as const) {
		const r = validateDesignProposal({ brief: brief(), theme: owner({ harmony: "analogous", h: 210, s: 75, l: 14, contrast: "AAA" }, mode) });
		assert.ok(r.ok, JSON.stringify(r));
		const tokens = r.proposal.contract.tokens as { color: { light: Record<string, string>; dark: Record<string, string> } };
		assert.ok(Object.keys(tokens.color.light).length >= 7 && Object.keys(tokens.color.dark).length >= 7);
		assert.notDeepEqual(tokens.color.light, tokens.color.dark);
		assert.deepEqual(modeCompletenessIssues(tokens.color), []);
	}
});

test("validate: a skin without a palette has no mode sets and is rejected", () => {
	const r = validateDesignProposal({ brief: brief(), theme: config({ palette: null }) });
	assert.equal(r.ok, false);
	if (r.ok) return;
	assert.ok(r.issues.some((issue) => issue.code === "missing_palette" && issue.path === "/theme/palette"));
});

test("validate: a skin missing one of its modes, or a required token of one, is rejected", () => {
	const light = { background: "#fff", foreground: "#111", card: "#fff", primary: "#06c", primaryForeground: "#fff", accent: "#eef", border: "#ddd" };
	assert.deepEqual(modeCompletenessIssues({ light, dark: light }), []);
	const noDark = modeCompletenessIssues({ light, dark: {} });
	assert.deepEqual(noDark.map((i) => [i.code, i.path]), [["missing_mode", "/contract/tokens/color/dark"]]);
	const noLight = modeCompletenessIssues({ dark: light });
	assert.deepEqual(noLight.map((i) => [i.code, i.path]), [["missing_mode", "/contract/tokens/color/light"]]);
	const partial = modeCompletenessIssues({ light, dark: { ...light, primary: "" } });
	assert.deepEqual(partial.map((i) => [i.code, i.path]), [["missing_mode_token", "/contract/tokens/color/dark/primary"]]);
	assert.equal(modeCompletenessIssues(undefined).length, 2, "no colour tokens at all: both modes missing");
});

test("validate: WCAG AA is checked in each mode; a failure in only one mode rejects the skin and names the mode", () => {
	const theme = owner({ harmony: "analogous", h: 200, s: 70, l: 50 }, "light");
	assert.deepEqual(themeContrastIssues(theme), []);
	const render = renderCustomSkin(theme);
	const flatDark = {
		...render,
		modes: { ...render.modes, dark: render.modes.dark.map(([prop, value]) => (prop === "--foreground" ? [prop, "hsl(0 0% 40%)"] : prop === "--background" ? [prop, "hsl(0 0% 45%)"] : [prop, value])) as Array<[string, string]> }
	};
	const issues = themeContrastIssues(theme, flatDark);
	assert.deepEqual(issues.map((i) => i.code), ["contrast_body"]);
	assert.match(issues[0]!.message, /in dark mode/);
	const flatLight = { ...render, modes: { ...render.modes, light: flatDark.modes.dark } };
	const light = themeContrastIssues(theme, flatLight);
	assert.deepEqual(light.map((i) => i.code), ["contrast_body"]);
	assert.match(light[0]!.message, /in light mode/);
});

test("every palette Design may pick passes AA in both modes over every base skin (the generator keeps both)", () => {
	const issues: string[] = [];
	for (const skin of [null, "claude", "cosmic-night", "neo-brutalism", "sky"] as const) {
		for (const harmony of ["monochromatic", "split", "tetradic"] as const) {
			for (const l of [8, 14, 50, 90]) {
				for (const s of [10, 90]) {
					const theme = config({ skin, palette: { harmony, h: 210, s, l } });
					for (const issue of themeContrastIssues(theme)) issues.push(`${skin} ${harmony} s${s} l${l}: ${issue.message}`);
				}
			}
		}
	}
	assert.deepEqual(issues, []);
});

function record(over: Partial<BrandSkinRecord> = {}): BrandSkinRecord {
	const r = validateDesignProposal({ brief: brief(), theme: owner({ harmony: "analogous", h: 210, s: 75, l: 14 }, "dark") });
	assert.ok(r.ok);
	return { id: "brand-titan", name: "TITAN", createdAt: "2026-11-28T10:18:05.801Z", source: "design", brief: r.proposal.brief, theme: r.proposal.theme, contract: r.proposal.contract, ...over };
}

function project(skins: BrandSkinRecord[]): Project {
	const base: Project = { id: "p1", title: "T", updatedAt: "2026-11-28T10:00:00.000Z", ext: {} } as never;
	return skins.reduce((acc, skin) => upsertBrandSkin(acc, skin, true), base);
}

test("edit: the same id, the next revision, createdAt kept; the brief and theme are the new ones", () => {
	const base = record();
	assert.equal(revisionOf(base), 1, "a record without a revision reads as 1");
	const next = validateDesignProposal({ brief: brief("TITAN"), theme: owner({ harmony: "analogous", h: 24, s: 90, l: 52 }, "light") });
	assert.ok(next.ok);
	const edited = editedBrandSkin(base, next.proposal, "2026-11-28T11:00:00.000Z");
	assert.equal(edited.id, "brand-titan");
	assert.equal(edited.createdAt, base.createdAt);
	assert.equal(edited.revision, 2);
	assert.equal(edited.updatedAt, "2026-11-28T11:00:00.000Z");
	assert.equal(edited.theme.palette?.h, 24);
	assert.equal(revisionOf(editedBrandSkin(edited, next.proposal)), 3);
	// stored in place: one skin, not two
	const stored = upsertBrandSkin(project([base]), edited, true);
	assert.equal(brandSkinsOf(stored).length, 1);
	assert.equal(brandSkinsOf(stored)[0]!.revision, 2);
	assert.equal(stored.skin, "brand-titan");
	assert.equal(designExtOf(stored).skins?.["brand-titan"]?.revision, 2, "the revision survives the ext round trip");
});

test("edit: an answer that changes nothing is detected (no new revision)", () => {
	const base = record();
	const same = validateDesignProposal({ brief: base.brief, theme: base.theme });
	assert.ok(same.ok);
	assert.equal(sameBrandSkinContent(base, same.proposal), true);
	const changed = validateDesignProposal({ brief: base.brief, theme: { ...base.theme, radius: 4 } });
	assert.ok(changed.ok);
	assert.equal(sameBrandSkinContent(base, changed.proposal), false);
});

test("edit prompt: the model gets the current skin, the id and the revision, and is told to change only what is asked", () => {
	const base = record({ revision: 3 });
	const edit: DesignBase = { id: base.id, name: base.name, revision: 3, brief: base.brief, theme: base.theme };
	const prompt = designSystemPrompt(edit);
	assert.match(prompt, /EDIT MODE: you are changing the existing Brand Skin "TITAN" \(id brand-titan, revision 3\)/);
	assert.match(prompt, /Apply only what the request asks and copy every other field/);
	assert.ok(prompt.includes(JSON.stringify({ brief: base.brief, theme: base.theme })), "the current tokens go to the model");
	assert.doesNotMatch(designSystemPrompt(), /Current skin/);
});

test("runDesignTurn with a base sends the edit prompt first and returns the validated updated skin", async () => {
	const base = record();
	const seen: DesignChatMessage[][] = [];
	const updated = { brief: base.brief, theme: { ...base.theme, radius: 4 } };
	const result = await runDesignTurn(
		"make the corners sharper",
		async (messages) => {
			seen.push([...messages]);
			return JSON.stringify(updated);
		},
		undefined,
		{ id: base.id, name: base.name, revision: 1, brief: base.brief, theme: base.theme }
	);
	assert.ok(result.ok);
	assert.equal(seen.length, 1);
	assert.match(seen[0]![0]!.content, /EDIT MODE/);
	assert.equal(seen[0]![1]!.content, "make the corners sharper");
	assert.equal(result.proposal.theme.radius, 4);
	assert.equal(sameBrandSkinContent(base, result.proposal), false);
});

test("wiring: Design edits the active skin by default, 'Create new' is explicit, Ask's Apply in Design goes the same path", () => {
	const web = (path: string) => readFileSync(new URL(`../../apps/chat-web/src/${path}`, import.meta.url), "utf8");
	const design = web("modules/chat/design/design.svelte.ts");
	assert.match(design, /const editing = designEditTarget\(\)/);
	assert.match(design, /editing \? baseOf\(editing\) : undefined/);
	assert.match(design, /if \(editing\) acceptEdit\(editing, result\.proposal\)/);
	assert.match(design, /editedBrandSkin\(editing, proposal\)/);
	assert.match(design, /newRequested = false/, "a created skin returns the next turn to editing");
	const panel = web("modules/chat/ui/DesignPanel.svelte");
	assert.match(panel, /data-action="design-create-new"/);
	assert.match(panel, /data-action="design-edit-skin"/);
	const chat = web("modules/chat/ui/ChatPanel.svelte");
	assert.match(chat, /async function onApplyInDesign[\s\S]*designSend\(text\)/, "Apply in Design sends to designSend, which edits the active skin");
});

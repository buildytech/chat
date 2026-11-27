/**
 * Design host validator (ADR 0070): brief shape, magazine-theme v2 import, completeness (slop) and WCAG AA contrast.
 * A failing proposal yields issues only — never a Brand Skin to write.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contrastRatio, MIN_BODY_AA, parseColor } from "../../apps/chat-web/src/lib/theme/brand-os-color.ts";
import { validateDesignProposal, themeContrastIssues } from "../../apps/chat-web/src/lib/theme/design-validate.ts";
import { importThemeConfig } from "../../apps/chat-web/src/lib/theme/custom-skin.ts";

const STOCK = readFileSync(new URL("./fixtures/stock-theme-export.json", import.meta.url), "utf8");

function brief(over: Record<string, unknown> = {}) {
	return {
		name: "Rye & Coal",
		thesis: {
			summary: "A neighbourhood bakery that treats fire and grain as craft.",
			positioning: "Serious bread for everyday tables, not a cafe lifestyle brand.",
			personality: ["warm", "exact"],
			antiPersonality: ["precious", "industrial-bland"],
			voice: { tone: ["plain", "assured"], avoid: ["hype"] }
		},
		grammar: {
			styleDirection: "tactile editorial",
			shapeLanguage: { core: "soft rectangles, generous margins" },
			imageTreatment: { style: "daylight grain", preferred: ["hands", "crumb"], avoid: ["stock smiles", "neon"] },
			contentVoice: { adjectives: ["warm"], avoid: ["disruptive"] }
		},
		...over
	};
}

function stockTheme() {
	const r = importThemeConfig(STOCK);
	assert.ok(r.ok, JSON.stringify(r));
	return r.config;
}

test("contrast math: body AA passes on black/white and fails on near-grey", () => {
	assert.ok(parseColor("#000000") && parseColor("hsl(0 0% 100%)"));
	const pass = contrastRatio("#111111", "#ffffff");
	const fail = contrastRatio("#747474", "#767676");
	assert.ok(pass !== null && pass >= MIN_BODY_AA, String(pass));
	assert.ok(fail !== null && fail < MIN_BODY_AA, String(fail));
});

test("validate: a complete brief and a real Stock theme passes and yields a brand-os contract", () => {
	const theme = stockTheme();
	assert.equal(themeContrastIssues(theme).length, 0, JSON.stringify(themeContrastIssues(theme)));
	const r = validateDesignProposal({ brief: brief(), theme });
	assert.ok(r.ok, JSON.stringify(r));
	assert.equal(r.proposal.brief.name, "Rye & Coal");
	assert.equal(r.proposal.theme.format, "magazine-theme");
	assert.equal(r.proposal.contract.schemaVersion, "1.0.0");
	const meta = r.proposal.contract.meta as { slug: string };
	assert.equal(meta.slug, "rye-coal");
});

test("validate: a missing brief field fails and yields no proposal", () => {
	const r = validateDesignProposal({ brief: brief({ thesis: { summary: "Only a summary." } }), theme: stockTheme() });
	assert.equal(r.ok, false);
	if (r.ok) return;
	assert.ok(r.issues.some((issue) => issue.code === "missing-positioning"));
	assert.ok(r.issues.some((issue) => issue.code === "missing-negative-constraints"));
	assert.equal("proposal" in r, false);
});

test("validate: an incomplete grammar (slop) fails and yields no proposal", () => {
	const thin = brief({ grammar: { styleDirection: "editorial" } });
	const r = validateDesignProposal({ brief: thin, theme: stockTheme() });
	assert.equal(r.ok, false);
	if (r.ok) return;
	assert.ok(r.issues.some((issue) => issue.code === "missing-shape-language"));
	assert.ok(r.issues.some((issue) => issue.code === "missing-image-constraints"));
	assert.equal("proposal" in r, false);
});

test("validate: a broken theme config fails and yields no proposal", () => {
	const r = validateDesignProposal({ brief: brief(), theme: { format: "other", version: 2 } });
	assert.equal(r.ok, false);
	if (r.ok) return;
	assert.ok(r.issues.some((issue) => issue.path.startsWith("/theme")));
	assert.equal("proposal" in r, false);
});

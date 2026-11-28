/**
 * Brand brief and completeness checks for Design mode. Completeness signals follow
 * ui8kit/brand-os (commit f0250f0, MIT, Copyright (c) 2026 UI8Kit) `validators/slop.ts`:
 * they report missing thesis, positioning and negative constraints, not taste.
 * No `node:*` imports.
 */
type BrandVoice = { tone?: string[]; avoid?: string[] };

type BrandThesis = {
	summary: string;
	positioning: string;
	personality?: string[];
	antiPersonality: string[];
	voice?: BrandVoice;
};

type BrandGrammar = {
	styleDirection?: string;
	shapeLanguage?: { core?: string };
	imageTreatment?: { style?: string; preferred?: string[]; avoid?: string[] };
	contentVoice?: { adjectives?: string[]; avoid?: string[] };
};

export type BrandBrief = {
	name: string;
	thesis: BrandThesis;
	grammar?: BrandGrammar;
};

export type DesignIssue = { code: string; path: string; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : []);

function voiceOf(value: unknown): BrandVoice | undefined {
	if (!isRecord(value)) return undefined;
	const tone = stringList(value.tone);
	const avoid = stringList(value.avoid);
	if (!tone.length && !avoid.length) return undefined;
	return { ...(tone.length ? { tone } : {}), ...(avoid.length ? { avoid } : {}) };
}

function grammarOf(value: unknown): BrandGrammar | undefined {
	if (!isRecord(value)) return undefined;
	const shape = isRecord(value.shapeLanguage) && nonEmpty(value.shapeLanguage.core) ? { core: value.shapeLanguage.core.trim() } : undefined;
	const image = isRecord(value.imageTreatment)
		? {
				...(nonEmpty(value.imageTreatment.style) ? { style: value.imageTreatment.style.trim() } : {}),
				...(stringList(value.imageTreatment.preferred).length ? { preferred: stringList(value.imageTreatment.preferred) } : {}),
				...(stringList(value.imageTreatment.avoid).length ? { avoid: stringList(value.imageTreatment.avoid) } : {})
			}
		: undefined;
	const content = isRecord(value.contentVoice)
		? {
				...(stringList(value.contentVoice.adjectives).length ? { adjectives: stringList(value.contentVoice.adjectives) } : {}),
				...(stringList(value.contentVoice.avoid).length ? { avoid: stringList(value.contentVoice.avoid) } : {})
			}
		: undefined;
	const styleDirection = nonEmpty(value.styleDirection) ? value.styleDirection.trim() : undefined;
	if (!shape && !image && !content && !styleDirection) return undefined;
	return {
		...(styleDirection ? { styleDirection } : {}),
		...(shape ? { shapeLanguage: shape } : {}),
		...(image && Object.keys(image).length ? { imageTreatment: image } : {}),
		...(content && Object.keys(content).length ? { contentVoice: content } : {})
	};
}

/** Read a brief from unknown JSON; returns issues and no brief when the required strings are missing. */
export function parseBrandBrief(value: unknown): { ok: true; brief: BrandBrief } | { ok: false; issues: DesignIssue[] } {
	if (!isRecord(value)) return { ok: false, issues: [{ code: "required_object", path: "/brief", message: "Expected a brief object." }] };
	const issues: DesignIssue[] = [];
	if (!nonEmpty(value.name)) issues.push({ code: "required_string", path: "/brief/name", message: "Give the brand a short name." });
	const thesis = isRecord(value.thesis) ? value.thesis : isRecord(value.brandThesis) ? value.brandThesis : null;
	if (!thesis) {
		issues.push({ code: "required_object", path: "/brief/thesis", message: "Expected a thesis object." });
	} else {
		if (!nonEmpty(thesis.summary)) issues.push({ code: "missing-thesis", path: "/brief/thesis/summary", message: "Add a concise brand thesis so outputs have a declared purpose." });
		if (!nonEmpty(thesis.positioning)) issues.push({ code: "missing-positioning", path: "/brief/thesis/positioning", message: "Positioning is not declared; category difference cannot be verified." });
		if (stringList(thesis.antiPersonality).length === 0) issues.push({ code: "missing-negative-constraints", path: "/brief/thesis/antiPersonality", message: "Declare what the brand must not become." });
	}
	if (issues.length) return { ok: false, issues };
	const t = thesis!;
	const brief: BrandBrief = {
		name: String(value.name).trim(),
		thesis: {
			summary: String(t.summary).trim(),
			positioning: String(t.positioning).trim(),
			antiPersonality: stringList(t.antiPersonality),
			...(stringList(t.personality).length ? { personality: stringList(t.personality) } : {}),
			...(voiceOf(t.voice) ? { voice: voiceOf(t.voice) } : {})
		},
		...(grammarOf(value.grammar) ?? grammarOf(value.designGrammar) ? { grammar: grammarOf(value.grammar) ?? grammarOf(value.designGrammar) } : {})
	};
	return { ok: true, brief };
}

/** Advisory completeness signals (brand-os slop heuristics) that the Design host treats as blocking issues. */
export function briefCompletenessIssues(brief: BrandBrief): DesignIssue[] {
	const issues: DesignIssue[] = [];
	if (!brief.grammar?.shapeLanguage?.core?.trim()) {
		issues.push({ code: "missing-shape-language", path: "/brief/grammar/shapeLanguage/core", message: "Color and typography alone do not define a recognisable system." });
	}
	if ((brief.grammar?.imageTreatment?.avoid?.length ?? 0) === 0) {
		issues.push({ code: "missing-image-constraints", path: "/brief/grammar/imageTreatment/avoid", message: "Image treatment has no explicit negative constraints." });
	}
	return issues;
}

function slugOf(name: string): string {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
	return slug || "brand";
}

/**
 * A brand-os schema 1.0.0 contract (VibeChat seed). Chat still applies the theme through magazine-theme / CSS variables.
 */
export function toBrandContract(brief: BrandBrief, tokens: { color: { light: Record<string, string>; dark: Record<string, string> }; fonts: { display: string; body: string }; radius: string }): Record<string, unknown> {
	return {
		schemaVersion: "1.0.0",
		meta: { name: brief.name, slug: slugOf(brief.name) },
		brandThesis: {
			summary: brief.thesis.summary,
			positioning: brief.thesis.positioning,
			personality: brief.thesis.personality ?? [],
			antiPersonality: brief.thesis.antiPersonality,
			...(brief.thesis.voice ? { voice: brief.thesis.voice } : {})
		},
		...(brief.grammar ? { designGrammar: brief.grammar } : {}),
		tokens: {
			color: { light: tokens.color.light, dark: tokens.color.dark },
			typography: { families: { display: tokens.fonts.display, body: tokens.fonts.body } },
			radius: { sm: tokens.radius, md: tokens.radius, lg: tokens.radius },
			shadow: { sm: "none", md: "none" }
		}
	};
}

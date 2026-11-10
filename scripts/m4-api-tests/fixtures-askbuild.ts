/**
 * The owner's failing Ask / Build session (exported 2026-11-10, restaurant delivery promo landing), reduced to its
 * structure: the page's blocks and variants as the Ask audit read them, the Ask rework plan (variant swaps per block),
 * the manual edits (revision history causes and block ids) and the token usage of the Build turns. The author's
 * Russian copy is left out; no ids, keys or credentials of the session are kept.
 */
export const OWNER_SCREEN = "screen.theme-marketing-landing/home";

/** Block id -> variant of the applied page when the owner asked Ask for a mini audit (Ask answer, turn 4). */
export const OWNER_VARIANTS: Record<string, string> = {
	"block-nav": "inline",
	"block-hero": "screenshot",
	"block-logos": "grid4",
	"block-features": "cells4",
	"block-steps": "columnIcons",
	"block-stats": "image",
	"block-testimonials": "plain",
	"block-faq": "list",
	"block-cta": "band",
	"block-footer": "columns"
};

/** Ask turn 5 ("rework blocks and content"): the variant swaps it recommended, as page-patch ops. */
export const OWNER_ASK_PLAN = {
	summary: "Festive rework: darker header, split hero, softer features, centered steps, stat cards, review grid.",
	ops: [
		{ op: "set_variant", blockId: "block-nav", variant: "inverse", reason: "Dark festive header" },
		{ op: "set_variant", blockId: "Hero", variant: "split", reason: "Photo of the table next to the offer" },
		{ op: "set_variant", blockId: "block-features", variant: "tilesMuted", reason: "Soft tiles" },
		{ op: "set_variant", blockId: "How it works", variant: "centered", reason: "3-4 centered steps" },
		{ op: "set_variant", blockId: "block-stats", variant: "cards", reason: "Bright figure cards" },
		{ op: "set_variant", blockId: "block-testimonials", variant: "grid3", reason: "Review grid" },
		{ op: "set_variant", blockId: "block-faq", variant: "twoColumns", reason: "Two columns" },
		{ op: "set_variant", blockId: "block-cta", variant: "split", reason: "Two actions" },
		{ op: "set_variant", blockId: "block-footer", variant: "newsletter", reason: "Newsletter footer" },
		// Not a variant of block.logos (the owner's Ask answer named row or grid4; a wrong one is shown with the list).
		{ op: "set_variant", blockId: "Logo cloud", variant: "marquee", reason: "Moving logos" },
		{ op: "set", blockId: "block-hero", field: "headline", value: "New Year grill delivery", reason: "Offer first" }
	]
};

/** Revision history causes after turn 3: three applies, then hand edits per block (revisions 4-54). */
export const OWNER_HISTORY_EDITS: Array<{ blockId: string; edits: number }> = [
	{ blockId: "block-logos", edits: 14 },
	{ blockId: "block-features", edits: 10 },
	{ blockId: "block-stats", edits: 13 },
	{ blockId: "block-testimonials", edits: 14 }
];

/** Provider usage of the owner's Build turns (prompt / total tokens). The accept turn ("accepted, do as you proposed"). */
export const OWNER_USAGE = {
	create: { prompt: 31734, total: 33035 },
	howItWorks: { prompt: 69471, total: 71056 },
	logoCloud: { prompt: 9540, total: 10199 },
	accept: { prompt: 9682, total: 10094 }
};

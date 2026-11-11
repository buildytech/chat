/**
 * Screen family of a page (ADR 0027, page-spec 1.4.0 provenance.family / familyPinned). Advisory only: derived from the
 * page's composition after every operation, it ranks the Blocks feed, picks where new sections take their Stock sample
 * and tells Ask what kind of page this is. It never rejects a block; the hard rules stay header first / footer last
 * (addSlotCheck), a renderer exists and the props schema passes.
 */
import type { PageBlock, PageBlockKind } from "@buildytech/page-contract";
import { familyLabelForKind, FAMILY_HOME_SCREENS } from "./provenance.ts";
import { getScreenById } from "./search.ts";
import { catalogSnapshot } from "./snapshot.ts";
import { rendererKindForLabel } from "./compatibility.ts";

export const PAGE_FAMILIES = ["dashboard", "landing", "food-grill", "restaurant", "generic"] as const;
export type PageFamily = (typeof PAGE_FAMILIES)[number];
/** The four families a page can lean to, in tie-break order (the start screens' order). */
export const NAMED_FAMILIES = ["landing", "food-grill", "restaurant", "dashboard"] as const satisfies readonly PageFamily[];
type NamedFamily = (typeof NAMED_FAMILIES)[number];

const HOME: Record<NamedFamily, string> = {
	landing: FAMILY_HOME_SCREENS[0],
	"food-grill": FAMILY_HOME_SCREENS[1],
	restaurant: FAMILY_HOME_SCREENS[2],
	dashboard: FAMILY_HOME_SCREENS[3]
};

export function isPageFamily(value: unknown): value is PageFamily {
	return typeof value === "string" && (PAGE_FAMILIES as readonly string[]).includes(value);
}

/** The Stock home screen of a named family (null for generic). */
export function familyScreenId(family: PageFamily): string | null {
	return family === "generic" ? null : HOME[family];
}

/** The family a Stock screen belongs to (null: another theme). */
export function familyOfScreen(screenId: string | null | undefined): NamedFamily | null {
	const screen = screenId ? getScreenById(screenId) : null;
	if (!screen) return null;
	for (const family of NAMED_FAMILIES) if (getScreenById(HOME[family])?.spec === screen.spec) return family;
	return null;
}

const kindCache = new Map<PageBlockKind, NamedFamily[]>();
/** The named families whose Stock screens have a section of this kind. */
export function familiesOfKind(kind: PageBlockKind): NamedFamily[] {
	const hit = kindCache.get(kind);
	if (hit) return hit;
	const found = NAMED_FAMILIES.filter((family) => {
		const screen = getScreenById(HOME[family]);
		return screen ? familyLabelForKind(screen, kind) !== null : false;
	});
	kindCache.set(kind, found);
	return found;
}

/** Kinds that every named family has (header, footer, ...) say nothing about the family. */
function telling(kind: PageBlockKind): NamedFamily[] | null {
	const families = familiesOfKind(kind);
	return families.length === 0 || families.length === NAMED_FAMILIES.length ? null : families;
}

/**
 * The family of a composition: the named family the most top-level sections belong to, when more than half of the
 * telling sections belong to it (ties go by NAMED_FAMILIES order); otherwise generic. No telling section: generic.
 */
export function deriveFamily(blocks: readonly Pick<PageBlock, "kind">[]): PageFamily {
	const votes = blocks.map((node) => telling(node.kind)).filter((families): families is NamedFamily[] => families !== null);
	if (votes.length === 0) return "generic";
	let best: NamedFamily | null = null;
	let bestScore = 0;
	for (const family of NAMED_FAMILIES) {
		const score = votes.filter((families) => families.includes(family)).length;
		if (score > bestScore) {
			best = family;
			bestScore = score;
		}
	}
	return best && bestScore * 2 > votes.length ? best : "generic";
}

/** Page kinds the family's screens have: the feed ranks blocks of these kinds first (generic: none, no boost). */
export function familyKinds(family: PageFamily): PageBlockKind[] {
	if (family === "generic") return [];
	const kinds = new Set<PageBlockKind>();
	for (const entry of catalogSnapshot.blockIndex) {
		const kind = entry.available ? rendererKindForLabel(entry.blockId) : null;
		if (kind) kinds.add(kind);
	}
	return [...kinds].filter((kind) => telling(kind)?.includes(family));
}

export type FamilyState = { family?: PageFamily | null; familyPinned?: boolean; screenId: string | null; scenarioId?: unknown };

/**
 * The provenance after a composition change: unchanged when pinned or when the derived family is the same, else the
 * new family. The page's recorded Stock screen stays (its sections keep their provenance); new sections sample from
 * it or, for a kind it lacks, from the first family that has the kind (kindSourceFor).
 */
export function nextFamilyState<T extends FamilyState>(current: T, blocks: readonly Pick<PageBlock, "kind">[]): T {
	if (current.familyPinned) return current;
	const family = deriveFamily(blocks);
	if (family === (current.family ?? null)) return current;
	return withFamily(current, family, false);
}

/** Set (or pin) a family; only the advisory fields change. */
export function withFamily<T extends FamilyState>(current: T, family: PageFamily, pinned: boolean): T {
	return { ...current, family, familyPinned: pinned };
}

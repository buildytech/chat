import { PAGE_LIMITS, type PageBlock, type PageBlockKind } from "@buildytech/page-contract";

// Slot rules and id helpers shared by the inspector (inspector.ts) and page-patch (patch.ts): pure, no catalog access.

/** Page chrome that stays at the top (header, side navigation) or at the bottom (footer, bottom navigation). */
const TOP_KINDS = new Set<PageBlockKind>(["sidenav", "nav"]);
const BOTTOM_KINDS = new Set<PageBlockKind>(["footer", "bottomnav"]);

export type AddSlotCheck = { ok: true } | { ok: false; code: "index_out_of_range" | "above_header" | "below_footer" | "header_top" | "footer_end"; message: string };

/** Which edge a chrome kind keeps to: "top" (header, side navigation), "bottom" (footer, bottom navigation), or null. */
export function chromeEdge(kind: PageBlockKind): "top" | "bottom" | null {
	return TOP_KINDS.has(kind) ? "top" : BOTTOM_KINDS.has(kind) ? "bottom" : null;
}

/**
 * Whether a new section of `kind` may go to top-level slot `at` (0 = before the first section, length = after the
 * last): content stays between the leading header run and the trailing footer run; a header goes in the leading run,
 * a footer in the trailing one. Pure, for drop feedback while dragging and for the add op itself.
 */
export function addSlotCheck(blocks: readonly Pick<PageBlock, "kind">[], kind: PageBlockKind, at: number): AddSlotCheck {
	if (!Number.isInteger(at) || at < 0 || at > blocks.length) return { ok: false, code: "index_out_of_range", message: `A section goes to slot 0..${blocks.length}.` };
	let leading = 0;
	while (leading < blocks.length && TOP_KINDS.has(blocks[leading]!.kind)) leading += 1;
	let trailing = blocks.length;
	while (trailing > leading && BOTTOM_KINDS.has(blocks[trailing - 1]!.kind)) trailing -= 1;
	if (TOP_KINDS.has(kind)) return at <= leading ? { ok: true } : { ok: false, code: "header_top", message: "A header goes at the top of the page." };
	if (BOTTOM_KINDS.has(kind)) return at >= trailing ? { ok: true } : { ok: false, code: "footer_end", message: "A footer goes at the end of the page." };
	if (at < leading) return { ok: false, code: "above_header", message: "Sections go below the header." };
	if (at > trailing) return { ok: false, code: "below_footer", message: "Sections go above the footer." };
	return { ok: true };
}

/**
 * The same rules for a section that moves (Sections buttons, Alt+Arrow, drag, inspector up / down): from `from` to
 * final index `to`, checked as a slot among the other sections. A header stays in the leading run, a footer in the
 * trailing one, content between them.
 */
export function moveSlotCheck(blocks: readonly Pick<PageBlock, "kind">[], from: number, to: number): AddSlotCheck {
	const moving = blocks[from];
	if (!moving || !Number.isInteger(to) || to < 0 || to >= blocks.length) return { ok: false, code: "index_out_of_range", message: `A section moves to 1..${blocks.length}.` };
	const others = blocks.filter((_, index) => index !== from);
	return addSlotCheck(others, moving.kind, to);
}

/** Ids of `node` and its rows made unique against `taken` (`block-hero` -> `block-hero-2`), within the id length. */
export function withFreshIds(node: PageBlock, taken: Set<string>): PageBlock {
	const fresh = (id: string) => {
		if (!taken.has(id)) {
			taken.add(id);
			return id;
		}
		for (let n = 2; ; n += 1) {
			const suffix = `-${n}`;
			const candidate = `${id.slice(0, PAGE_LIMITS.maxIdLength - suffix.length)}${suffix}`;
			if (!taken.has(candidate)) {
				taken.add(candidate);
				return candidate;
			}
		}
	};
	const copy: PageBlock = { ...node, id: fresh(node.id) };
	if (node.children?.length) copy.children = node.children.map((child) => withFreshIds(child, taken));
	return copy;
}


export function walkIds(blocks: readonly PageBlock[], out = new Set<string>()): Set<string> {
	for (const node of blocks) {
		out.add(node.id);
		walkIds(node.children ?? [], out);
	}
	return out;
}


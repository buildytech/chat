/**
 * Media mode (t109u), pure part: which blocks of a page have a picture slot (`image` + `imageAlt` props), the aspect each
 * one draws at (from the block's layout props, the same expressions the registry blocks use for their `MediaFrame`
 * ratio), and the prompt sent to the image model. The prompt is the slot's `imageAlt` (the author-facing description,
 * written by Build) + the page art direction + the aspect + "no text". Nothing here writes the page.
 */
import type { PageV2 } from "@buildytech/page-contract";

export type MediaAspect = "1:1" | "4:3" | "3:4" | "16:9" | "21:9";
type Props = Record<string, unknown>;

/** Item -> the frame its picture is drawn in. Read from registry/svelte/src/blocks/<item>.svelte (pictureRatio / ratio). */
const ASPECT_OF: Record<string, (props: Props) => MediaAspect> = {
	"hero-simple": (p) => (p.media === "top" || p.media === "bottom" ? "21:9" : p.ratio === "portrait" ? "3:4" : "4:3"),
	"article-lead": (p) => (p.media === "top" ? "21:9" : "4:3"),
	"feature-showcase-simple": (p) => (p.media === "top" ? "21:9" : "4:3"),
	"product-simple": (p) => (p.media === "top" ? "21:9" : "4:3"),
	"promo-simple": (p) => (p.media === "top" ? "21:9" : "4:3"),
	"figure-simple": (p) => (p.layout === "wide" ? "16:9" : "4:3"),
	"split-simple": () => "4:3",
	"locations-simple": () => "1:1",
	"profile-intro": () => "1:1"
};

/** Items whose list records each draw one picture (`items[i].image`, 4:3, alt = the record title in the block). */
const LIST_ITEMS: ReadonlySet<string> = new Set(["menu-simple", "products-simple", "rooms-simple"]);

/** One picture slot: `key` names it in `ext.media` (the block id, or `<block id>/items/<i>` for a list record), `pointer` is the prop it fills. */
export type ImageSlot = { key: string; blockId: string; pointer: string; item: string; variant: string; aspect: MediaAspect; alt: string; title: string; image: string };

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const isRecord = (value: unknown): value is Props => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function listSlots(blockId: string, item: string, variant: string, props: Props): ImageSlot[] {
	const items = Array.isArray(props.items) ? props.items : [];
	return items.filter(isRecord).map((row, index) => {
		const title = text(row.title);
		const detail = text(row.description);
		return { key: `${blockId}/items/${index}`, blockId, pointer: `/items/${index}/image`, item, variant, aspect: "4:3", alt: detail ? `${title}: ${detail}` : title, title, image: text(row.image) };
	});
}

/** The picture slots of a page in page order: blocks that draw one picture, then each record of a picture list. */
export function imageSlots(page: PageV2 | null | undefined): ImageSlot[] {
	if (!page) return [];
	return page.blocks.flatMap((block) => {
		const props: Props = block.props ?? {};
		const variant = block.variant ?? "";
		if (LIST_ITEMS.has(block.item)) return listSlots(block.id, block.item, variant, props);
		const aspectOf = ASPECT_OF[block.item];
		if (!aspectOf) return [];
		return [{ key: block.id, blockId: block.id, pointer: "/image", item: block.item, variant, aspect: aspectOf(props), alt: text(props.imageAlt), title: text(props.title), image: text(props.image) }];
	});
}

const FRAME: Record<MediaAspect, string> = {
	"1:1": "square frame, subject centred",
	"4:3": "landscape 4:3 frame beside text, subject filling the frame",
	"3:4": "tall portrait 3:4 frame, vertical composition",
	"16:9": "wide 16:9 frame",
	"21:9": "very wide 21:9 banner frame, subject spread horizontally with calm space at the edges"
};

/** The art direction a page starts with (the author edits it in Media mode); the skin names the palette of the theme. */
export function defaultStyle(skin: string | null): string {
	const palette = skin ? `colour accents in harmony with the ${skin} theme palette` : "a restrained, natural colour palette";
	return `Realistic commercial photography, soft natural light, shallow depth of field, ${palette}, one consistent look across the page.`;
}

const NO_TEXT = "No text, letters, numbers, logos, signs or watermarks anywhere in the image.";

/** The prompt of one slot: what is in the frame (imageAlt, else the block title), the page art direction, the frame, no text. */
export function mediaPrompt(slot: Pick<ImageSlot, "alt" | "title" | "aspect">, style: string, extra = ""): string {
	const sentence = (part: string): string => (part.trim() ? `${part.trim().replace(/[.\s]+$/, "")}.` : "");
	return [sentence(slot.alt || slot.title), sentence(extra), sentence(style), `Composition: ${FRAME[slot.aspect]}.`, NO_TEXT].filter(Boolean).join(" ");
}

/** Why a slot's candidates no longer match the block: its frame or its description changed since they were drawn. */
export function staleReason(slot: Pick<ImageSlot, "alt" | "aspect">, drawn: { alt: string; aspect: string } | null | undefined): "aspect" | "alt" | null {
	if (!drawn) return null;
	if (drawn.aspect !== slot.aspect) return "aspect";
	if (drawn.alt !== slot.alt) return "alt";
	return null;
}

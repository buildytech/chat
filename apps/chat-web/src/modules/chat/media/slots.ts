/**
 * Media mode (t109u), pure part: which pictures of a page have a slot (a block's `image` + `imageAlt`, and every large record
 * picture the registry block draws, ADR 0063), the aspect each
 * one draws at (from the block's layout props, the same expressions the registry blocks use for their `MediaFrame`
 * ratio), and the prompt sent to the image model. The prompt is the slot's `imageAlt` (the author-facing description,
 * written by Build) + the page art direction + the aspect + "no text". Nothing here writes the page.
 */
import { recordPictures } from "@buildytech/builder-core";
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

/** A registry frame ratio ("4/3") -> the frame Media mode draws at; an unknown ratio draws landscape. */
const ASPECT_OF_RATIO: Record<string, MediaAspect> = { "1/1": "1:1", "4/3": "4:3", "3/4": "3:4", "16/9": "16:9", "21/9": "21:9" };

/** One picture slot: `key` names it in `ext.media` (the block id, or `<block id>/<list>/<i>` for a list record), `pointer` is the prop it fills. */
export type ImageSlot = { key: string; blockId: string; pointer: string; item: string; variant: string; aspect: MediaAspect; alt: string; title: string; image: string };

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const isRecord = (value: unknown): value is Props => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * The slots of the list records of a block: every record picture the registry block draws large (pictures.json, derived from
 * the block; ADR 0063). Icon-size pictures (feature icons, reviewer avatars, contact icons) and brand logos keep the
 * placeholder: they are not drawn. A portrait (an `avatar` field) is described as one.
 */
function listSlots(blockId: string, item: string, variant: string, props: Props): ImageSlot[] {
	return recordPictures(item, props)
		.filter((picture) => picture.size === "large")
		.flatMap((picture) => {
			const list = props[picture.list];
			const rows: unknown[] = Array.isArray(list) ? list : [];
			return rows.flatMap((row, index) => {
				if (!isRecord(row)) return [];
				const title = text(row.title);
				const detail = text(row.description);
				const described = picture.alt === "title" ? (detail ? `${title}: ${detail}` : title) : text(row[picture.alt]) || title;
				const alt = picture.field === "avatar" && described ? `Portrait photo of a person: ${described}` : described;
				const aspect = ASPECT_OF_RATIO[picture.ratio] ?? "4:3";
				return [{ key: `${blockId}/${picture.list}/${index}`, blockId, pointer: `/${picture.list}/${index}/${picture.field}`, item, variant, aspect, alt, title, image: text(row[picture.field]) }];
			});
		});
}

/** The picture slots of a page in page order: per block its own picture, then each large record picture. */
export function imageSlots(page: PageV2 | null | undefined): ImageSlot[] {
	if (!page) return [];
	return page.blocks.flatMap((block) => {
		const props: Props = block.props ?? {};
		const variant = block.variant ?? "";
		const aspectOf = ASPECT_OF[block.item];
		const own: ImageSlot[] = aspectOf ? [{ key: block.id, blockId: block.id, pointer: "/image", item: block.item, variant, aspect: aspectOf(props), alt: text(props.imageAlt), title: text(props.title), image: text(props.image) }] : [];
		return [...own, ...listSlots(block.id, block.item, variant, props)];
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

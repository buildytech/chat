/** Media mode (t109u), pure part: picture slots of a page, the frame from the variant, the prompt from imageAlt, staleness. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultStyle, imageSlots, mediaPrompt, staleReason } from "../../apps/chat-web/src/modules/chat/media/slots.ts";

const page = {
	version: 2,
	title: "Шашлык на дом",
	slug: "shashlik",
	locale: "ru",
	seo: { title: "t", description: "d" },
	blocks: [
		{ id: "h", item: "header-simple", variant: "default", props: { brand: "Мангал" } },
		{ id: "a", item: "hero-simple", variant: "mediaEnd", props: { title: "Шашлык", media: "end", ratio: "landscape", imageAlt: "Сочный шашлык из свиной шеи на шампурах над углями мангала" } },
		{ id: "b", item: "hero-simple", variant: "mediaTop", props: { title: "Шашлык", media: "top", ratio: "landscape" } },
		{ id: "c", item: "hero-simple", variant: "mediaEndPortrait", props: { title: "Шашлык", media: "end", ratio: "portrait" } },
		{ id: "d", item: "promo-simple", variant: "mediaTop", props: { title: "Скидка", media: "top" } },
		{ id: "e", item: "figure-simple", variant: "wide", props: { title: "Кухня", layout: "wide", image: "https://imgen.x.ai/x.jpeg" } }
	]
} as const;

test("picture slots: only blocks that draw one picture, with the frame of their layout", () => {
	const slots = imageSlots(page);
	assert.deepEqual(slots.map((s) => [s.blockId, s.aspect]), [["a", "4:3"], ["b", "21:9"], ["c", "3:4"], ["d", "21:9"], ["e", "16:9"]]);
	assert.equal(slots[0].alt, "Сочный шашлык из свиной шеи на шампурах над углями мангала");
	assert.equal(slots[4].image, "https://imgen.x.ai/x.jpeg");
	assert.deepEqual(imageSlots(null), []);
});

test("prompt = imageAlt (else the title) + extra + art direction + frame + no text", () => {
	const [first, second] = imageSlots(page);
	const prompt = mediaPrompt(first, "Тёплый вечерний свет, тёмный фон.", "крупный план");
	assert.ok(prompt.startsWith("Сочный шашлык из свиной шеи на шампурах над углями мангала. крупный план. Тёплый вечерний свет"));
	assert.match(prompt, /landscape 4:3 frame/);
	assert.match(prompt, /No text, letters, numbers, logos/);
	assert.ok(mediaPrompt(second, "s").startsWith("Шашлык."));
	assert.match(defaultStyle("sky"), /sky theme palette/);
	assert.match(defaultStyle(null), /natural colour palette/);
});

test("stale: a changed frame or description since the candidates were drawn", () => {
	const [first] = imageSlots(page);
	assert.equal(staleReason(first, null), null);
	assert.equal(staleReason(first, { alt: first.alt, aspect: "4:3" }), null);
	assert.equal(staleReason(first, { alt: first.alt, aspect: "21:9" }), "aspect");
	assert.equal(staleReason(first, { alt: "другое", aspect: "4:3" }), "alt");
});

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
		{ id: "e", item: "figure-simple", variant: "wide", props: { title: "Кухня", layout: "wide", image: "https://imgen.x.ai/x.jpeg" } },
		{ id: "m", item: "menu-simple", variant: "cards3", props: { items: [{ id: "1", title: "Шашлык из баранины", description: "Нежная баранина с пряностями" }, { id: "2", title: "Люля-кебаб" }] } }
	]
} as const;

test("picture slots: only blocks that draw one picture, with the frame of their layout", () => {
	const slots = imageSlots(page);
	assert.deepEqual(slots.map((s) => [s.key, s.aspect, s.pointer]), [["a", "4:3", "/image"], ["b", "21:9", "/image"], ["c", "3:4", "/image"], ["d", "21:9", "/image"], ["e", "16:9", "/image"], ["m/items/0", "4:3", "/items/0/image"], ["m/items/1", "4:3", "/items/1/image"]]);
	assert.equal(slots[5].alt, "Шашлык из баранины: Нежная баранина с пряностями");
	assert.equal(slots[6].alt, "Люля-кебаб");
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

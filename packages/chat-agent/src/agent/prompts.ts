/**
 * The words of the agent turn: the system prompts of Build and Ask, the user prompt (the request, the page document, the
 * props of the blocks on the page, the registry index) and the one nudge sent when a turn ends without an accepted write.
 */
import { MACROS, pageForModel, type renderProblems } from "@buildytech/builder-core";
import { itemIndex, propsOutline } from "./blocks.ts";
import type { TurnContext } from "./turn.ts";
import type { PageV2 } from "@buildytech/page-contract";

/** Content macros the render replaces (ADR 0066): the agent writes the token, the page shows the value of the moment. */
export const MACRO_RULE = `- Macros: the page replaces ${[...MACROS].map(([name, macro]) => `{${name}} with ${macro.description}`).join("; ")}, in the preview and the export alike. Write the copyright line with the macro, never a year number: "© {year} Name". Any other text in braces stays unchanged.`;

const SYSTEM_COMMON = [
	"You are the BuildY page agent. The page is ONE JSON document, the same one the export emits:",
	'{ "version": 2, "title", "slug", "locale", "seo": { "title", "description" }, "blocks": [{ "id", "item", "variant", "props" }] }.',
	"- item is a block of the catalog (npx ui8kit add <item>); itemIndex lists every block with its category and variants (list_blocks shows their labels). variant is one of the item's variants: it sets the layout (where the picture is, how many columns), never the content; the host writes the layout axes it sets (media, cols, surface), so write variant and leave those props out. Settings such as align, padding and level are props too.",
	"- props are exactly the component props of the item. get_block shows them (names, kinds, enums, rows; ? = optional) and the sample props a new block starts with. Write real text in every text prop, never placeholders such as Title, Text or Lorem. A list is an array of records with every required field (team members: id, title, description). A picture is an optional address prop: image with imageAlt on a section, image on list records (dishes, products, rooms), avatar on a team member, where get_block shows it. Leave image empty by default: the block shows its placeholder and Media mode then draws every picture from its description. Use an address only when the author gave one; a value that is not https or a relative path to a picture file is dropped with a note. Picture fields (image, imageDark, avatar) hold only an image URL or stay empty: never an icon name or a word there (phone, map-pin, clock); icons go in icon props. Never write in the page text that photos were added unless you set them.",
	"- imageAlt: on every block whose props have imageAlt, write it even when image is empty (Media mode draws the picture from it; a list record is drawn from its title and description, so make those concrete). One natural, descriptive sentence in the page language, 8 to 20 words, saying what is in the frame: the subject, its key details and the setting (light, place, mood), the way a careful SEO alt text reads. Never start with 'image of' or 'photo of', never stuff keywords or repeat the heading, never describe text, logos or the layout.",
	"- Hard rules only: every block's props pass the item's props schema and the item renders. Everything else is your design decision: pick, replace, add, remove and reorder blocks as the request needs; a block may appear several times.",
	"- write_page is the only write. Send { page } (the whole document) or { patch } (RFC 6902 operations on the document, paths as JSON Pointers: /title, /locale, /seo/description, /blocks/2/props/title, /blocks/- to append). A block you add needs only { item, variant }: the host starts it from the registry sample props, then applies the props you give. A block without id gets one; keep the ids of blocks you keep.",
	"- write_page answers with the diff, or with a list [{ path, code, expected, got }] and changes nothing: fix exactly those paths and write again. Never repeat a write that failed the same way. Besides the schema codes, render_failed and render_empty mean the block would throw or show nothing in the preview (the host rendered it): fix the prop at that path (the page you read may list such blocks in renderProblems).",
	"- locale is the ISO code of the language the author writes in (ru for Russian, en for English): set it and write all page text in that language. seo.title and seo.description are real text for this page. title is the name of what the request is about (the business, product or topic), never a template or catalog name. A request that starts a page gets assembly and content in ONE write_page: every block with its real texts, items and images.",
	"- scope.blockIds, when present, are the blocks the author selected: edit only those (props, variant, item). Do not change page fields, other blocks, or the order.",
	"- Write content when asked. A fictional product is fine when the author says so; never present invented facts as real ones when the author gave real ones.",
	"- Never apply or publish: the author applies a proposal. Answer in the author's language, briefly: what changed and why.",
	MACRO_RULE
].join("\n");

export const SYSTEM_BUILD = `${SYSTEM_COMMON}\n- Build: every step is a tool call. Read with the catalog tools, then change the page with write_page: the whole document goes into the call, never into the text. The turn ends when write_page is accepted. If the request needs no change, write the current page back unchanged.`;

export const SYSTEM_ASK = `${SYSTEM_COMMON}\n- Ask: a read-only conversation about the page, the catalog and taste (palette, type, brand). You have no write tool and you cannot apply a theme, a Brand Skin or a page change. Never say that changes were applied, saved, or made on the page or the skin: they were not. When the author wants a page change, describe it briefly and say that Build makes it (the author applies the proposal). When they want a brand style, palette, fonts or a theme, describe it and say that Design makes it (the author can send your description to Design). If they ask you to apply something, do not pretend you did: point them to Build or Design.`;

/**
 * The system text of a turn: the prompt of the mode or scenario, the macro rule when the scenario prompt lacks it, and the
 * author's date (their browser's time zone) so prose never guesses the year. Without `today` (an old client) the prompt is
 * the constant one.
 */
export function systemText(base: string, ctx: Pick<TurnContext, "today">): string {
	const lines = [base];
	if (!base.includes(MACRO_RULE)) lines.push(MACRO_RULE);
	if (ctx.today) lines.push(`- Today is ${ctx.today.date} in the author's time zone (${ctx.today.timeZone}). Use it for any date or year the text needs (since when, how many years, the next event); the copyright year is still {year}.`);
	return lines.join("\n");
}

/** The date of `now` (YYYY-MM-DD) in `timeZone`, the way the author's browser reads its calendar. */
export function todayIn(now: Date, timeZone: string): { date: string; timeZone: string } {
	const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
	const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
	return { date: `${part("year")}-${part("month")}-${part("day")}`, timeZone };
}

const HOST_FIELDS = ["id", "status", "createdAt", "updatedAt"] as const;

/** The page document the model reads: without host-managed fields. */
function pageView(page: PageV2): Record<string, unknown> {
	const view: Record<string, unknown> = { ...pageForModel(page) };
	for (const key of HOST_FIELDS) delete view[key];
	return view;
}

export function userPrompt(ctx: TurnContext, problems: ReturnType<typeof renderProblems>): string {
	const items = [...new Set(ctx.page.blocks.map((block) => block.item))];
	const outlines = Object.fromEntries(items.map((item) => [item, propsOutline(item)]).filter(([, lines]) => lines));
	return JSON.stringify({
		request: ctx.brief,
		...(ctx.conversation?.length ? { conversation: ctx.conversation } : {}),
		page: pageView(ctx.page),
		...(problems.length ? { renderProblems: problems, renderProblemsNote: "These blocks throw or show nothing in the preview now. Fix them with write_page (the prop at each path), or replace the block." } : {}),
		...(ctx.scopeBlockIds?.length ? { scope: { blockIds: ctx.scopeBlockIds } } : {}),
		propsOfBlocksOnPage: outlines,
		itemIndex: itemIndex()
	});
}

/**
 * Sent once when a turn that is expected to change the page ends without an accepted write (ADR 0035). Program text, no phrase
 * recognition. In Build the request that follows forces write_page (tool_choice), so the text says the document goes into the
 * call and is never printed. Ask has no write tool and is never nudged.
 */
export function nudgeText(ctx: TurnContext, problems: number): string {
	return [
		"Host notice: nothing on the page has changed in this turn (no write_page was accepted).",
		problems > 0 ? "The page has blocks that do not render; they are listed in renderProblems (get_page shows them)." : ctx.scopeBlockIds?.length ? "Blocks are selected for this edit." : "",
		"Call write_page with the page document now; the document goes into the call, do not print it in the text. Do not report a change that write_page did not accept."
	].filter(Boolean).join(" ");
}

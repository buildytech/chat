/**
 * The words of the agent turn: the system prompts of Build and Ask, the user prompt (the request, the page document, the
 * props of the blocks on the page, the registry index) and the one nudge sent when a turn ends without an accepted write.
 */
import { pageForModel, type renderProblems } from "@buildytech/builder-core";
import { itemIndex, propsOutline } from "./blocks.ts";
import type { TurnContext } from "./turn.ts";
import type { PageV2 } from "@buildytech/page-contract";

const SYSTEM_COMMON = [
	"You are the BuildY page agent. The page is ONE JSON document, the same one the export emits:",
	'{ "version": 2, "title", "slug", "locale", "seo": { "title", "description" }, "blocks": [{ "id", "item", "variant", "props" }] }.',
	"- item is a block of the catalog (npx ui8kit add <item>); itemIndex lists every block with its category and variants (list_blocks shows their labels). variant is one of the item's variants: it sets the layout (where the picture is, how many columns), never the content; the host writes the layout axes it sets (media, cols, surface), so write variant and leave those props out. Settings such as align, padding and level are props too.",
	"- props are exactly the component props of the item. get_block shows them (names, kinds, enums, rows; ? = optional) and the sample props a new block starts with. Write real text in every text prop, never placeholders such as Title, Text or Lorem. A list is an array of records with every required field (team members: id, title, description). A picture is an optional address prop: image with imageAlt on the hero, avatar on a team member, where get_block shows it; without it the block shows a placeholder, which is fine, so leave pictures out by default. Never invent a URL. Set a picture only when the author gave an address or asked for photos; then use only a direct https image URL of a real public photo you are sure exists (stock sites like images.unsplash.com or images.pexels.com), with a short imageAlt of what it shows; a value that is not https or a relative path is dropped with a note. Never write in the page text that photos were added unless you set them.",
	"- Hard rules only: every block's props pass the item's props schema and the item renders. Everything else is your design decision: pick, replace, add, remove and reorder blocks as the request needs; a block may appear several times.",
	"- write_page is the only write. Send { page } (the whole document) or { patch } (RFC 6902 operations on the document, paths as JSON Pointers: /title, /locale, /seo/description, /blocks/2/props/title, /blocks/- to append). A block you add needs only { item, variant }: the host starts it from the registry sample props, then applies the props you give. A block without id gets one; keep the ids of blocks you keep.",
	"- write_page answers with the diff, or with a list [{ path, code, expected, got }] and changes nothing: fix exactly those paths and write again. Never repeat a write that failed the same way. Besides the schema codes, render_failed and render_empty mean the block would throw or show nothing in the preview (the host rendered it): fix the prop at that path (the page you read may list such blocks in renderProblems).",
	"- locale is the ISO code of the language the author writes in (ru for Russian, en for English): set it and write all page text in that language. seo.title and seo.description are real text for this page. title is the name of what the request is about (the business, product or topic), never a template or catalog name. A request that starts a page gets assembly and content in ONE write_page: every block with its real texts, items and images.",
	"- scope.blockIds, when present, are the blocks the author selected: edit only those (props, variant, item). Do not change page fields, other blocks, or the order.",
	"- Write content when asked. A fictional product is fine when the author says so; never present invented facts as real ones when the author gave real ones.",
	"- Never apply or publish: the author applies a proposal. Answer in the author's language, briefly: what changed and why."
].join("\n");

export const SYSTEM_BUILD = `${SYSTEM_COMMON}\n- Build: every step is a tool call. Read with the catalog tools, then change the page with write_page: the whole document goes into the call, never into the text. The turn ends when write_page is accepted. If the request needs no change, write the current page back unchanged.`;

export const SYSTEM_ASK = `${SYSTEM_COMMON}\n- Ask: a read-only conversation about the page and the catalog. You have no write tool here: answer in text. When the author wants a change, describe it briefly and say that Build makes it.`;

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

import { blocksOf, type CreatorPage } from "./page";

/**
 * CodePort stub: Latte-ish source from the same Page DTO as PreviewPort.
 * Not a Latte compiler. WP publish is out of this pass (ADR-0003).
 */
export function latteFromPage(page: CreatorPage): string {
	const blocks = blocksOf(page);
	const lines: string[] = [
		`{* CodePort stub from Page DTO ${page.id} (${page.slug}). Not a Latte compiler. ADR-0003. *}`,
		`{layout 'Main/page.latte'}`,
		``,
		`{block #content}`
	];
	for (const block of blocks) {
		lines.push(`	<section data-block="${block.kind}" data-id="${block.id}">`);
		lines.push(`		<h2>{$page->blocks['${block.id}']['title']}</h2>`);
		lines.push(`	</section>`);
	}
	lines.push(`{/block}`);
	lines.push(``);
	return lines.join("\n");
}

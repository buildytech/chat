import { blocksOf, PAGE_COPY_KEYS, type CreatorPage, type PageBlock } from "./page";
import { walkBlocks } from "./tree";

function macroName(id: string): string {
	return id.replace(/-/g, "_");
}

function selectedMark(block: PageBlock, selectedId: string | null): string {
	return block.id === selectedId ? " {* selected *}" : "";
}

function copyLines(block: PageBlock, indent: string): string[] {
	const copy = block.copy;
	if (!copy) return [];
	const lines: string[] = [];
	for (const key of PAGE_COPY_KEYS) {
		if (!copy[key]) continue;
		lines.push(
			`${indent}<p data-copy="${key}">{$page->blocks['${block.id}']['copy']['${key}']}</p>`
		);
	}
	return lines;
}

function emitDefine(block: PageBlock, selectedId: string | null): string[] {
	const name = macroName(block.id);
	const selectedAttr = block.id === selectedId ? ` data-selected="true"` : "";
	const lines: string[] = [
		`{define #${name}}`,
		`	<section data-block="${block.kind}" data-id="${block.id}"${selectedAttr}>`,
		`		<h2>{$page->blocks['${block.id}']['title']}</h2>`
	];
	lines.push(...copyLines(block, "		"));
	if (block.children?.length) {
		lines.push(`		{foreach $page->blocks['${block.id}']['children'] as $child}`);
		lines.push(`			{include #item, item: $child}`);
		lines.push(`		{/foreach}`);
	}
	lines.push(`	</section>`);
	lines.push(`{/define}`);
	return lines;
}

export function latteForBlock(block: PageBlock, selectedId: string | null = null): string {
	return emitDefine(block, selectedId).join("\n") + "\n";
}

/**
 * CodePort emitter: Latte source from the same Page DTO as PreviewPort.
 * Compiles with PHP Latte 3 when the CodePort runtime pack is present
 * (`codeport-pack/Main/page.latte`, shipped in ZIP as `Main/page.latte`).
 * WP publish remains out of this pass (ADR-0003).
 */
export function latteFromPage(page: CreatorPage, selectedId: string | null = null): string {
	const roots = blocksOf(page);
	const nodes = walkBlocks(roots);
	const lines: string[] = [
		`{* CodePort page from DTO ${page.id} (${page.slug}). Requires Main/page.latte. ADR-0003. *}`,
		`{layout 'Main/page.latte'}`,
		``,
		`{var $selectedId = '${selectedId ?? ""}'}`,
		`{var $pageTitle = $page->title}`,
		``,
		`{define #item, $item}`,
		`	<article data-block="{$item['kind']}" data-id="{$item['id']}">`,
		`		<h3>{$item['title']}</h3>`,
		`		<p>{$item['summary']}</p>`,
		`		{if $item['id'] === $selectedId}{* selected child *}{/if}`,
		`	</article>`,
		`{/define}`,
		``
	];

	for (const node of nodes) {
		lines.push(...emitDefine(node, selectedId));
		lines.push(``);
	}

	lines.push(`{block #content}`);
	for (const block of roots) {
		lines.push(`	{include #${macroName(block.id)}}${selectedMark(block, selectedId)}`);
	}
	lines.push(`{/block}`);
	lines.push(``);
	return lines.join("\n");
}

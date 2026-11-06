// ../../packages/page-contract/src/types.ts
var PAGE_BLOCK_KINDS = [
  "nav",
  "nav-link",
  "hero",
  "features",
  "feature",
  "menu",
  "dish",
  "hours",
  "cta",
  "footer"
];
var PAGE_COPY_KEYS = [
  "eyebrow",
  "headline",
  "lede",
  "action",
  "note",
  "brand",
  "contact",
  "legal",
  "days",
  "address"
];
var PAGE_STATUSES = [
  "draft",
  "pending",
  "scheduled",
  "published",
  "archived",
  "trashed"
];
function blocksOf(page) {
  return page.layout.blocks;
}

// ../../packages/page-contract/src/validate.ts
var COPY_KEY_SET = new Set(PAGE_COPY_KEYS);
var KIND_SET = new Set(PAGE_BLOCK_KINDS);
var STATUS_SET = new Set(PAGE_STATUSES);

// src/lib/page-store/tree.ts
function walkBlocks(blocks) {
  const out = [];
  for (const block of blocks) {
    out.push(block);
    if (block.children?.length) {
      out.push(...walkBlocks(block.children));
    }
  }
  return out;
}

// src/lib/page-store/latte.ts
function macroName(id) {
  return id.replace(/-/g, "_");
}
function selectedMark(block, selectedId) {
  return block.id === selectedId ? " {* selected *}" : "";
}
function copyLines(block, indent) {
  const copy = block.copy;
  if (!copy) return [];
  const lines = [];
  for (const key of PAGE_COPY_KEYS) {
    if (!copy[key]) continue;
    lines.push(
      `${indent}<p data-copy="${key}">{$page->blocks['${block.id}']['copy']['${key}']}</p>`
    );
  }
  return lines;
}
function emitDefine(block, selectedId) {
  const name = macroName(block.id);
  const selectedAttr = block.id === selectedId ? ` data-selected="true"` : "";
  const lines = [
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
function latteForBlock(block, selectedId = null) {
  return emitDefine(block, selectedId).join("\n") + "\n";
}
function latteFromPage(page, selectedId = null) {
  const roots = blocksOf(page);
  const nodes = walkBlocks(roots);
  const lines = [
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
export {
  latteForBlock,
  latteFromPage
};

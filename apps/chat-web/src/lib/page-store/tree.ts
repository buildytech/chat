import type { PageBlock } from "./page";

/** Depth-first flattening of the layout tree. */
export function walkBlocks(blocks: PageBlock[]): PageBlock[] {
	const out: PageBlock[] = [];
	for (const block of blocks) {
		out.push(block);
		if (block.children?.length) {
			out.push(...walkBlocks(block.children));
		}
	}
	return out;
}

export function findBlock(blocks: PageBlock[], id: string | null | undefined): PageBlock | null {
	if (!id) return null;
	for (const block of blocks) {
		if (block.id === id) return block;
		const nested = findBlock(block.children ?? [], id);
		if (nested) return nested;
	}
	return null;
}

export function firstBlockId(blocks: PageBlock[]): string | null {
	return blocks[0]?.id ?? null;
}

export function hasBlock(blocks: PageBlock[], id: string | null | undefined): boolean {
	return findBlock(blocks, id) !== null;
}

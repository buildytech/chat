import type { PageBlock } from "./page";

export function findBlock(blocks: readonly PageBlock[], id: string | null | undefined): PageBlock | null {
	if (!id) return null;
	return blocks.find((block) => block.id === id) ?? null;
}

export function firstBlockId(blocks: readonly PageBlock[]): string | null {
	return blocks[0]?.id ?? null;
}

export function hasBlock(blocks: readonly PageBlock[], id: string | null | undefined): boolean {
	return findBlock(blocks, id) !== null;
}

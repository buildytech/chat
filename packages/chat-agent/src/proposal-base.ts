/**
 * baseHash of a Build proposal (t85u step 6): the hash of each block the proposal changes, removes or moves, taken on
 * the page the turn started from, and on the applied page at that moment. A chat-local record (session ext
 * `chat-proposal-base`, format proposal-base/1): the page-spec/v2 record and the contract's proposal stay as they are.
 *   - When the reply arrives, the page the turn read (the pending candidate or the applied page) must still hold those
 *     blocks: a block edited by hand during the run blocks the proposal (it would overwrite the edit).
 *   - On Apply the applied page must still hold the blocks as they were when the turn started.
 */
import type { BlockV2, PageV2 } from "@buildytech/page-contract";
import { fnv1a64 } from "./identity.ts";

type Diffed = { scope: string; change: string; id?: string };
type BaseHashes = Record<string, string | null>;
export type ProposalBase = { format: "proposal-base/1"; source: "candidate" | "applied" | "empty"; baseRevision: number; base: BaseHashes; applied: BaseHashes };

/** The identity of one block's content: item, variant and props (canonical key order of the stored document). */
export function blockBaseHash(block: Pick<BlockV2, "item" | "variant" | "props"> | undefined): string | null {
	return block ? `fnv1a64:${fnv1a64(JSON.stringify({ item: block.item, variant: block.variant ?? null, props: block.props ?? {} }))}` : null;
}

/** The hashes of the blocks a diff touches (changed, removed, moved; an added block has no base) on a page. */
export function baseHashes(page: PageV2 | null | undefined, diff: readonly Diffed[]): BaseHashes {
	const ids = [...new Set(diff.flatMap((entry) => (entry.scope === "block" && entry.change !== "added" && entry.id ? [entry.id] : [])))];
	return Object.fromEntries(ids.map((id) => [id, blockBaseHash(page?.blocks.find((block) => block.id === id))]));
}

/** The block ids whose content on `page` is no longer what `hashes` recorded (edited, removed or added by hand). */
export function staleBlocks(page: PageV2 | null | undefined, hashes: BaseHashes): string[] {
	return Object.entries(hashes).flatMap(([id, hash]) => (blockBaseHash(page?.blocks.find((block) => block.id === id)) === hash ? [] : [id]));
}

const isHashes = (value: unknown): value is BaseHashes => typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every((x) => x === null || typeof x === "string");
function isProposalBase(value: unknown): value is ProposalBase {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const v: Record<string, unknown> = { ...value };
	return v.format === "proposal-base/1" && typeof v.baseRevision === "number" && ["candidate", "applied", "empty"].includes(String(v.source)) && isHashes(v.base) && isHashes(v.applied);
}

/** The stored records by message id; an entry that is not a record is left out (never reinterpreted). */
export function readProposalBases(value: unknown): Record<string, ProposalBase> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, ProposalBase] => isProposalBase(entry[1])));
}

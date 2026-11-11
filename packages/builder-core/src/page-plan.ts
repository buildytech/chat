import { PAGE_SLOTS, type Page, type PageBlock } from "@buildytech/page-contract";
import type { LayoutProposal, LayoutProposalError, ProposalContext } from "./assemble.ts";
import { askBlockCard } from "./catalog/details.ts";
import { catalogVariantsFor } from "./catalog/sources.ts";
import { editPage, normalizePatch } from "./patch.ts";
import { catalogBlocksForKind, swapCatalogBlock } from "./block-swap.ts";

/**
 * Ask page plans (ADR 0020): when Ask recommends page changes it sends them as page-patch/v1 ops on the current
 * page (`propose_plan`), not only as prose. The host checks every op on its own against the page and the pinned
 * catalog (the same editPage gates as Build edits) and keeps the result on the Ask message: valid ops can be ticked
 * and run by Apply in Build without a model call; invalid ops stay as notes with the allowed values.
 */

export const PLAN_LIMITS = { maxOps: 24, maxReason: 400, maxSummary: 1200 } as const;
export const PLAN_OPS = ["set_variant", "set", "set_items", "add", "replace", "remove", "move"] as const;
export type PlanOpName = (typeof PLAN_OPS)[number];

export type PlanItem = { label: string; detail?: string; value?: string; note?: string; group?: string; icon?: string };

export type PagePlanOp = {
	id: string;
	op: PlanOpName;
	blockId?: string;
	field?: string;
	value?: string | null;
	variant?: string | null;
	kind?: string;
	/** replace (ADR 0023): the Stock catalog block that takes the block's place, same kind. */
	catalogBlock?: string;
	/** replace: text fields the new catalog block does not render (dropped when it runs). */
	dropped?: string[];
	title?: string;
	copy?: Record<string, string>;
	items?: PlanItem[];
	to?: number;
	at?: number;
	/** Why (the model's words, page language, short). */
	reason?: string;
	/** Display: the target block as the author sees it (title and catalog block), host-made. */
	label?: string;
	/** set_variant: the variant the block has now. */
	from?: string;
	valid: boolean;
	issue?: { code: string; message: string; allowed?: string[] };
	result?: { status: "applied" | "rejected" | "skipped"; code?: string; message?: string };
};

export type PagePlanStatus = "proposed" | "executed" | "partial" | "failed";

export type PagePlan = {
	status: PagePlanStatus;
	pageId: string;
	/** Page revision the plan was checked against. */
	baseRevision: number;
	summary?: string;
	ops: PagePlanOp[];
	executedAt?: string;
};

type Provenance = ProposalContext["currentProvenance"];

/** Issue / result code of an op that would not change the page (same variant, same value): a no-op, not an error. */
export const PLAN_NOOP = "no_change";

/**
 * A plan op that changes nothing on the page it was checked against (ADR 0020 follow-up): the card shows it as
 * "keep" (unticked, muted), it is never run and never counted as rejected. Stored with the session 1.4.0 shape:
 * `valid: false` with `issue.code` no_change, or a `skipped` result with code no_change.
 */
export function isPlanNoop(op: Pick<PagePlanOp, "issue" | "result">): boolean {
	return op.issue?.code === PLAN_NOOP || op.result?.code === PLAN_NOOP;
}

/** True when some op is really invalid (needs a fix); no-ops do not count. */
export function planHasInvalid(plan: PagePlan | null | undefined): boolean {
	return Boolean(plan?.ops.some((op) => !op.valid && !isPlanNoop(op)));
}

/** True when the patch result is the same page (no block, order or page field changed). */
function unchanged(base: Page, next: Page): boolean {
	const report = describePageChanges(base, next);
	return !report.added.length && !report.removed.length && !report.changed.length && !report.moved.length && !report.pageFields.length;
}

function noopMessage(op: PagePlanOp): string {
	if (op.op === "set_variant") return `${op.blockId} already uses ${op.variant}.`;
	if (op.op === "set") return `${op.blockId ?? "page"} ${op.field ?? ""} already has this value.`.replace(/\s+/g, " ");
	return `${op.blockId ?? op.kind ?? "page"} already matches this op.`;
}

/** A short reference to a page block: title, catalog block (or kind) and id. */
export type BlockRef = { id: string; title: string; name: string };

export function blockRef(node: PageBlock): BlockRef {
	return { id: node.id, title: node.title, name: node.catalogBlock ?? node.kind };
}

function norm(value: string): string {
	return value.toLowerCase().replace(/["'`\u00ab\u00bb\u201c\u201d]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Resolve how the author or a model names a block to its id on the page: the id itself, the block's title, its
 * catalog block (block.logos or logos), the catalog title of that block (Logo cloud) or a page kind that only one
 * block has. Null when nothing or more than one block matches.
 */
export function resolveBlockRef(page: Page | null | undefined, ref: unknown): string | null {
	if (!page || typeof ref !== "string" || !ref.trim()) return null;
	const blocks = page.layout.blocks;
	if (blocks.some((node) => node.id === ref)) return ref;
	const want = norm(ref);
	const names = (node: PageBlock): string[] => {
		const out = [node.title, node.id, node.id.replace(/^block-/, "")];
		if (node.catalogBlock) {
			out.push(node.catalogBlock, node.catalogBlock.replace(/^block\./, ""));
			const card = askBlockCard(node.catalogBlock);
			if (card) out.push(card.title, card.label);
		}
		return out.map(norm);
	};
	const hits = blocks.filter((node) => names(node).includes(want));
	if (hits.length === 1) return hits[0]!.id;
	if (hits.length > 1) return null;
	const kind = blocks.filter((node) => node.kind === want);
	return kind.length === 1 ? kind[0]!.id : null;
}

/** Compact page directory both modes see (ADR 0020): id, kind, catalog block and its catalog title, variant, headings. */
export function pageDirectory(page: Page): Array<Record<string, unknown>> {
	return page.layout.blocks.map((node) => {
		const card = node.catalogBlock ? askBlockCard(node.catalogBlock) : null;
		const heading = node.copy?.headline ?? node.summary;
		return {
			id: node.id,
			kind: node.kind,
			title: node.title,
			...(node.catalogBlock ? { block: node.catalogBlock } : {}),
			...(card && card.title !== node.title ? { blockTitle: card.title } : {}),
			...(node.variant ? { variant: node.variant } : {}),
			...(heading && heading !== node.title ? { heading: heading.slice(0, 120) } : {}),
			...(node.children?.length ? { rows: node.children.length } : {}),
			// Copy keys the block renders; with headline, title only names the block in the section list.
			...(PAGE_SLOTS[node.kind]?.copy.length ? { copyKeys: PAGE_SLOTS[node.kind]!.copy } : {})
		};
	});
}

function str(value: unknown, max = 4000): string | undefined {
	return typeof value === "string" ? value.slice(0, max) : undefined;
}

/** The page-patch/v1 op of a plan op (host fields dropped). */
function patchOp(op: PagePlanOp): Record<string, unknown> {
	const { id: _id, reason: _r, label: _l, from: _f, valid: _v, issue: _i, result: _res, dropped: _d, ...rest } = op;
	return rest;
}

function rawOp(raw: unknown, page: Page, index: number): PagePlanOp {
	const rec = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
	const name = String(rec.op ?? "");
	const op: PagePlanOp = { id: `op-${index + 1}`, op: (PLAN_OPS as readonly string[]).includes(name) ? (name as PlanOpName) : "set", valid: false };
	if (!(PLAN_OPS as readonly string[]).includes(name)) {
		op.issue = { code: "op_not_in_plan", message: `${name || "(empty)"} is not a plan op. Ops: ${PLAN_OPS.join(", ")}.` };
	}
	const reason = str(rec.reason, PLAN_LIMITS.maxReason);
	if (reason) op.reason = reason;
	if (typeof rec.blockId === "string") op.blockId = resolveBlockRef(page, rec.blockId) ?? rec.blockId;
	if (typeof rec.field === "string") op.field = rec.field;
	if (typeof rec.value === "string" || rec.value === null) op.value = rec.value as string | null;
	if (typeof rec.variant === "string" || (rec.variant === null && name === "set_variant")) op.variant = rec.variant as string | null;
	if (typeof rec.kind === "string") op.kind = rec.kind;
	if (name === "replace" && typeof rec.catalogBlock === "string" && rec.catalogBlock.trim()) {
		// block.storehero, storehero or storehero/overlay; the variant after the slash when none is given.
		const [spec, inline] = rec.catalogBlock.trim().split("/");
		op.catalogBlock = spec!.startsWith("block.") ? spec! : `block.${spec}`;
		if (inline && typeof rec.variant !== "string") op.variant = inline;
	}
	if (typeof rec.title === "string") op.title = rec.title;
	if (rec.copy && typeof rec.copy === "object" && !Array.isArray(rec.copy)) {
		op.copy = Object.fromEntries(Object.entries(rec.copy as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string>;
	}
	if (Array.isArray(rec.items)) op.items = rec.items.filter((row) => row && typeof row === "object") as PlanItem[];
	if (typeof rec.to === "number") op.to = rec.to;
	if (typeof rec.at === "number") op.at = rec.at;
	const target = op.blockId ? page.layout.blocks.find((node) => node.id === op.blockId) : undefined;
	if (target) {
		op.label = target.catalogBlock ? `${target.title} (${target.catalogBlock})` : target.title;
		if (op.op === "set_variant" && target.variant) op.from = target.variant;
		if (op.op === "replace" && op.catalogBlock) {
			if (!op.kind) op.kind = target.kind;
			if (target.catalogBlock) op.from = `${target.catalogBlock}${target.variant ? `/${target.variant}` : ""}`;
		}
	}
	return op;
}

type Base = { page: Page; provenance?: Provenance; revision: number; sessionDemoData?: boolean; now?: string };

function runOps(base: Base, ops: Array<Record<string, unknown>>): LayoutProposal | LayoutProposalError {
	return editPage({
		page: base.page,
		provenance: base.provenance,
		patch: normalizePatch({ baseRevision: base.revision, ops }),
		expectedRevision: base.revision,
		sessionDemoData: Boolean(base.sessionDemoData),
		liveTurn: false,
		now: base.now
	});
}

/** The values a rejected op could take (unknown_variant: the block's catalog variants). */
function allowedFor(op: PagePlanOp, page: Page, code: string): string[] | undefined {
	const target = op.blockId ? page.layout.blocks.find((node) => node.id === op.blockId) : undefined;
	if (op.op === "replace" && op.catalogBlock) {
		if (code === "unknown_variant") return catalogVariantsFor(op.catalogBlock);
		if (target && (code === "catalog_block_kind_mismatch" || code === "unknown_catalog_block" || code === "no_renderer")) {
			return catalogBlocksForKind(target.kind).filter((spec) => spec !== target.catalogBlock);
		}
	}
	if (code === "unknown_variant" && target?.catalogBlock) return catalogVariantsFor(target.catalogBlock);
	if (code === "block_not_found") return page.layout.blocks.map((node) => node.id);
	return undefined;
}

/**
 * Check a plan from the wire (propose_plan arguments or an Ask reply) against the page: every op alone through the
 * page-patch gates. Never trusts validity from the wire; returns null when there is no page or no op.
 */
export function checkPagePlan(input: Base & { raw: unknown }): PagePlan | null {
	const rec = input.raw && typeof input.raw === "object" && !Array.isArray(input.raw) ? (input.raw as Record<string, unknown>) : null;
	const list = Array.isArray(rec?.ops) ? rec!.ops.slice(0, PLAN_LIMITS.maxOps) : [];
	if (!list.length) return null;
	const ops = list.map((raw, index) => {
		const op = rawOp(raw, input.page, index);
		if (op.issue) return op;
		const target = op.blockId ? input.page.layout.blocks.find((node) => node.id === op.blockId) : undefined;
		if (op.op === "set_variant" && target && op.variant && target.variant === op.variant) {
			return { ...op, issue: { code: PLAN_NOOP, message: noopMessage(op) } };
		}
		const result = runOps(input, [patchOp(op)]);
		if (result.ok && unchanged(input.page, result.page)) return { ...op, issue: { code: PLAN_NOOP, message: noopMessage(op) } };
		if (result.ok) return { ...op, valid: true, ...swapDropped(op, target) };
		if (result.code === PLAN_NOOP) return { ...op, issue: { code: PLAN_NOOP, message: noopMessage(op) } };
		const allowed = allowedFor(op, input.page, result.code);
		return { ...op, issue: { code: result.code, message: result.message.slice(0, 600), ...(allowed ? { allowed } : {}) } };
	});
	const summary = str(rec?.summary, PLAN_LIMITS.maxSummary);
	return { status: "proposed", pageId: input.page.id, baseRevision: input.revision, ...(summary ? { summary } : {}), ops };
}

/** replace with a catalog block: the fields the new block does not render, against the block as it is now. */
function swapDropped(op: PagePlanOp, target: PageBlock | undefined): { dropped?: string[] } {
	if (op.op !== "replace" || !op.catalogBlock || !target) return {};
	const swap = swapCatalogBlock(target, { catalogBlock: op.catalogBlock, variant: op.variant ?? null });
	return swap.ok && swap.dropped.length ? { dropped: swap.dropped } : {};
}

/** Plan result for the tool loop: valid ops, and each invalid op with its code, message and allowed values. */
export function compactPlanPayload(plan: PagePlan | null): Record<string, unknown> {
	if (!plan) return { ok: false, code: "plan_empty", message: "propose_plan needs ops on currentPage block ids." };
	return {
		ok: true,
		valid: plan.ops.filter((op) => op.valid).map((op) => op.id),
		...(plan.ops.some((op) => op.dropped?.length)
			? { dropped: plan.ops.filter((op) => op.dropped?.length).map((op) => ({ id: op.id, fields: op.dropped })) }
			: {}),
		invalid: plan.ops.filter((op) => !op.valid && !isPlanNoop(op)).map((op) => ({ id: op.id, op: op.op, blockId: op.blockId, ...op.issue })),
		...(plan.ops.some(isPlanNoop) ? { unchanged: plan.ops.filter(isPlanNoop).map((op) => op.id) } : {}),
		note: "Shown to the author as a plan card; nothing changed. Fix invalid ops once with the allowed values, or explain them in text. Unchanged ops already match the page: do not resend them."
	};
}

export type PlanExecution = {
	plan: PagePlan;
	proposal: LayoutProposal | LayoutProposalError | null;
};

/**
 * Apply in Build: run the selected valid ops in order on the current page, deterministically (no model call). An op
 * that no longer applies (the page changed by hand since the plan) is rejected with its code; the others still
 * apply (partial acceptance, ADR 0018). One proposal for the ops that applied, pending until the author applies it.
 */
export function executePagePlan(input: Base & { plan: PagePlan; selected: readonly string[]; at?: string }): PlanExecution {
	const pick = new Set(input.selected);
	const applied: PagePlanOp[] = [];
	let page = input.page;
	const keep = (op: PagePlanOp, message?: string): PagePlanOp => ({
		...op,
		result: { status: "skipped", code: PLAN_NOOP, message: message ?? op.issue?.message ?? noopMessage(op) }
	});
	const ops = input.plan.ops.map((op): PagePlanOp => {
		if (isPlanNoop(op) && !op.valid) return keep(op);
		if (!pick.has(op.id)) return { ...op, result: { status: "skipped" } };
		if (!op.valid) return { ...op, result: { status: "rejected", code: op.issue?.code ?? "invalid", message: op.issue?.message } };
		const target = op.blockId ? page.layout.blocks.find((node) => node.id === op.blockId) : undefined;
		// The page may already have what the op asks for (hand edit since the plan, an earlier op): keep, not an error.
		if (op.op === "set_variant" && target && op.variant && target.variant === op.variant) return keep(op, noopMessage(op));
		const step = runOps({ ...input, page }, [patchOp(op)]);
		if (!step.ok && step.code === PLAN_NOOP) return keep(op, noopMessage(op));
		if (!step.ok) return { ...op, result: { status: "rejected", code: step.code, message: step.message.slice(0, 600) } };
		if (unchanged(page, step.page)) return keep(op, noopMessage(op));
		// The block as it is now (hand edits since the plan included) decides what the new catalog block drops.
		const swap = swapDropped(op, target);
		const ran: PagePlanOp = { ...op };
		if (op.op === "replace" && op.catalogBlock) {
			if (swap.dropped) ran.dropped = swap.dropped;
			else delete ran.dropped;
		}
		page = step.page;
		applied.push(ran);
		return { ...ran, result: { status: "applied", ...(ran.dropped?.length ? { message: `Dropped (not rendered by ${op.catalogBlock}): ${ran.dropped.join(", ")}.` } : {}) } };
	});
	const proposal = applied.length ? runOps(input, applied.map(patchOp)) : null;
	// No-ops (kept) are not counted: a plan whose ticked ops all applied is executed even if some ops were kept.
	const chosen = ops.filter((op) => pick.has(op.id) && !isPlanNoop(op));
	const done = chosen.filter((op) => op.result?.status === "applied").length;
	const kept = ops.some((op) => pick.has(op.id) && isPlanNoop(op));
	const status: PagePlanStatus =
		proposal && !proposal.ok ? "failed" : chosen.length === 0 ? (kept ? "executed" : "failed") : done === 0 ? "failed" : done === chosen.length ? "executed" : "partial";
	return { plan: { ...input.plan, ops, status, executedAt: input.at ?? new Date().toISOString() }, proposal };
}

export type PageChange = BlockRef & {
	fields: string[];
	variant?: { from: string | null; to: string | null };
	/** Another catalog block in the same place (replace, ADR 0023). */
	block?: { from: string | null; to: string | null };
};

export type PageChangeReport = {
	added: BlockRef[];
	removed: BlockRef[];
	changed: PageChange[];
	moved: BlockRef[];
	kept: BlockRef[];
	pageFields: string[];
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** What a proposal changes versus the page it was made from, block by block (ids, titles, catalog blocks). */
export function describePageChanges(base: Page | null | undefined, next: Page): PageChangeReport {
	const report: PageChangeReport = { added: [], removed: [], changed: [], moved: [], kept: [], pageFields: [] };
	if (!base) {
		report.added = next.layout.blocks.map(blockRef);
		return report;
	}
	const before = new Map(base.layout.blocks.map((node) => [node.id, node]));
	const after = new Map(next.layout.blocks.map((node) => [node.id, node]));
	for (const node of base.layout.blocks) if (!after.has(node.id)) report.removed.push(blockRef(node));
	const commonBefore = base.layout.blocks.filter((node) => after.has(node.id)).map((node) => node.id);
	const commonAfter = next.layout.blocks.filter((node) => before.has(node.id)).map((node) => node.id);
	for (const node of next.layout.blocks) {
		const old = before.get(node.id);
		if (!old) {
			report.added.push(blockRef(node));
			continue;
		}
		const fields: string[] = [];
		if (old.kind !== node.kind || old.catalogBlock !== node.catalogBlock) fields.push("block");
		if (old.title !== node.title) fields.push("title");
		if (!same(old.copy, node.copy) || old.summary !== node.summary) fields.push("copy");
		if (!same(old.children, node.children)) fields.push("rows");
		const variant = (old.variant ?? null) !== (node.variant ?? null) ? { from: old.variant ?? null, to: node.variant ?? null } : undefined;
		const swapped = old.catalogBlock !== node.catalogBlock ? { from: old.catalogBlock ?? null, to: node.catalogBlock ?? null } : undefined;
		if (fields.length || variant) report.changed.push({ ...blockRef(node), fields, ...(variant ? { variant } : {}), ...(swapped ? { block: swapped } : {}) });
		else if (commonBefore.indexOf(node.id) !== commonAfter.indexOf(node.id)) report.moved.push(blockRef(node));
		else report.kept.push(blockRef(node));
	}
	if (base.title !== next.title) report.pageFields.push("title");
	if (!same(base.seo, next.seo)) report.pageFields.push("seo");
	return report;
}

/** Manual edits since the last agent turn, per block (from the chat's revision history). */
export type ManualEdit = { blockId: string; edits: number };

export function manualEditsSince(
	history: ReadonlyArray<{ cause: string; at: string; blockId?: string }> | undefined,
	since: string | null | undefined
): ManualEdit[] {
	const counts = new Map<string, number>();
	for (const entry of history ?? []) {
		if (entry.cause !== "edit" || !entry.blockId) continue;
		if (since && entry.at <= since) continue;
		counts.set(entry.blockId, (counts.get(entry.blockId) ?? 0) + 1);
	}
	return [...counts].map(([blockId, edits]) => ({ blockId, edits })).slice(0, 40);
}

export function parseManualEdits(raw: unknown): ManualEdit[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((row): row is { blockId: string; edits: number } => Boolean(row && typeof row === "object" && typeof (row as ManualEdit).blockId === "string" && typeof (row as ManualEdit).edits === "number"))
		.map((row) => ({ blockId: row.blockId.slice(0, 200), edits: Math.max(1, Math.min(9999, Math.floor(row.edits))) }))
		.slice(0, 40);
}

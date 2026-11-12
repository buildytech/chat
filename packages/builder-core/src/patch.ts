import { stripAxisOverrides } from "./catalog/organism.ts";
import {
	PAGE_LIMITS,
	PAGE_SLOTS,
	pagePatchIssues,
	pagePatchSchema,
	parsePageSpec,
	type Page,
	type PageBlock,
	type PageBlockCopy,
	type PageBlockKind,
	type PageCopyKey
} from "@buildytech/page-contract";
import {
	arrangeShell,
	CHILD_ONLY_KINDS,
	localizeEmptyLedes,
	naturalIndexFor,
	stockBlockFor,
	type LayoutProposal,
	type LayoutProposalError,
	type ProposalContext,
	type ProposalIntent
} from "./assemble.ts";
import { catalogProvenance } from "./catalog/snapshot.ts";
import { getScreenById } from "./catalog/search.ts";
import { attachCatalogSources, familyLabelForKind, kindSourceFor, validateCatalogProvenance } from "./catalog/provenance.ts";
import { catalogSourceFor, resolveCatalogChoice } from "./catalog/sources.ts";
import { swapCatalogBlock } from "./block-swap.ts";
import { DATA_KINDS, defaultDemoLabel, demoLabelForLocale } from "./content.ts";
import { MODEL_CATALOG_VERSION, POLICY_VERSION, TRIAL_POLICY_VERSION } from "./policy.ts";

/**
 * page-patch/v1 edits (https://schema.buildy.tw/page-patch.schema.json) on the trusted current page.
 *
 * The model sends operations, never a layout. Program-level gates, in order:
 * 1. the published page-patch schema (shape, plain text, closed keys);
 * 2. per operation: the target block exists, slot validation (only copy keys and row fields the
 *    target kind renders, rows within the kind's limit; page-spec x-page-slots), data rows only when
 *    demo data was requested, add / replace only kinds the page's Stock screen family has;
 * 3. the result: page-spec/v1 schema + parsePage program checks + the Stock catalog provenance gate.
 * Any failure rejects the whole patch (code + path); the base page is never modified.
 */

export type PatchOp = Record<string, unknown> & { op: string };
export type PagePatchContext = {
 scopeBlockIds?: readonly string[];
	page: Page;
	provenance?: ProposalContext["currentProvenance"];
	patch: unknown;
	expectedRevision: number;
	/** Typed intent from the model: demo data requested (true), declined (false), not mentioned. */
	demoData?: boolean;
	/** Host flag: the author asked for demo data earlier in this chat. */
	sessionDemoData?: boolean;
	demoLabel?: string;
	liveTurn?: boolean;
	now?: string;
	brief?: string;
};

type Failure = { ok: false; code: string; message: string; path?: string };
const fail = (code: string, message: string, path?: string): Failure => ({ ok: false, code, message, path });

function walk(blocks: PageBlock[]): PageBlock[] {
	return blocks.flatMap((node) => [node, ...walk(node.children ?? [])]);
}

/** The sibling array that holds `id`, and its index. */
function locate(blocks: PageBlock[], id: string): { list: PageBlock[]; index: number; parent: PageBlock | null } | null {
	const stack: Array<{ list: PageBlock[]; parent: PageBlock | null }> = [{ list: blocks, parent: null }];
	while (stack.length) {
		const { list, parent } = stack.pop()!;
		const index = list.findIndex((node) => node.id === id);
		if (index >= 0) return { list, index, parent };
		for (const node of list) if (node.children?.length) stack.push({ list: node.children, parent: node });
	}
	return null;
}

function slotOf(kind: PageBlockKind) {
	return PAGE_SLOTS[kind];
}

function checkCopy(kind: PageBlockKind, copy: Record<string, unknown>, path: string): Failure | null {
	const allowed = slotOf(kind).copy as string[];
	for (const key of Object.keys(copy)) {
		if (!allowed.includes(key)) {
			return fail("slot_not_rendered", `${kind} does not render copy.${key}. Slots: ${allowed.join(", ")}.`, `${path}.${key}`);
		}
	}
	return null;
}

type Item = { label: string; detail?: string; value?: string; note?: string; group?: string; icon?: string };

function rowsFor(block: PageBlock, items: Item[], path: string): PageBlock[] | Failure {
	const slot = slotOf(block.kind).items;
	if (!slot) return fail("slot_no_rows", `${block.kind} has no rows.`, path);
	if (items.length > slot.max) return fail("rows_over_limit", `${block.kind} renders at most ${slot.max} rows.`, path);
	const rows: PageBlock[] = [];
	for (const [index, item] of items.entries()) {
		for (const key of Object.keys(item)) {
			if (!slot.fields.includes(key)) {
				return fail("row_field_not_rendered", `${slot.kind} rows render ${slot.fields.join(", ")}, not ${key}.`, `${path}[${index}].${key}`);
			}
		}
		const row: PageBlock = {
			id: `${block.id}-item-${index + 1}`.slice(0, PAGE_LIMITS.maxIdLength),
			kind: slot.kind,
			title: item.label.slice(0, PAGE_LIMITS.maxTitleLength),
			summary: (item.detail ?? item.note ?? item.label).slice(0, PAGE_LIMITS.maxSummaryLength)
		};
		const copy: PageBlockCopy = {};
		if (item.value) copy.value = item.value;
		if (item.note) copy.note = item.note;
		if (item.group) copy.eyebrow = item.group;
		if (item.icon) copy.icon = item.icon;
		if (Object.keys(copy).length) row.copy = copy;
		rows.push(row);
	}
	return rows;
}

function withCopy(block: PageBlock, copy: Record<string, string> | undefined): PageBlock {
	if (!copy || !Object.keys(copy).length) return block;
	const next = { ...block, copy: { ...block.copy, ...copy } };
	if (copy.lede) next.summary = copy.lede.slice(0, PAGE_LIMITS.maxSummaryLength);
	return next;
}

function hasDemoBadge(blocks: PageBlock[]): boolean {
	return walk(blocks).some((node) => typeof node.copy?.badge === "string" && node.copy.badge.length > 0);
}

const OP_KEYS: Record<string, readonly string[]> = Object.fromEntries(
	(pagePatchSchema.$defs.op.oneOf as unknown as Array<{ properties: Record<string, { const?: string }> }>).map((branch) => [
		String(branch.properties.op?.const),
		Object.keys(branch.properties)
	])
);
const UNION_KEYS = new Set(Object.values(OP_KEYS).flat());

/**
 * Tool-call hygiene before the strict schema: a model fills unused union fields with null or "".
 * Those empty fields are dropped; any other key stays, so the schema still rejects it.
 */
export function normalizePatch(raw: unknown): unknown {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
	const rec = raw as Record<string, unknown>;
	if (!Array.isArray(rec.ops)) return raw;
	const out: Record<string, unknown> = { ...rec };
	for (const key of ["demoData", "demoLabel"]) delete out[key];
	if (out.baseRevision == null) delete out.baseRevision;
	out.ops = rec.ops.map((op) => {
		if (!op || typeof op !== "object" || Array.isArray(op)) return op;
		const row = op as Record<string, unknown>;
		const allowed = OP_KEYS[String(row.op)];
		if (!allowed) return op;
		const clean: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(row)) {
			const empty =
				value === null ||
				value === undefined ||
				value === "" ||
				(Array.isArray(value) && value.length === 0) ||
				(typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0);
			if (!allowed.includes(key)) {
				if (UNION_KEYS.has(key) && empty) continue;
				clean[key] = value;
				continue;
			}
			if (key === "copy" && value && typeof value === "object" && !Array.isArray(value)) {
				const copy = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== ""));
				if (Object.keys(copy).length) clean.copy = copy;
				continue;
			}
			if (key !== "value" && key !== "items" && !(key === "variant" && row.op === "set_variant") && empty) continue;
			clean[key] = value;
		}
		return clean;
	});
	return out;
}

/** Apply page-patch/v1 to the current page and return an unapplied proposal (Apply stays with the author). */
export function editPage(ctx: PagePatchContext): LayoutProposal | LayoutProposalError {
	const issues = pagePatchIssues(ctx.patch);
	if (issues.length) {
		const first = issues[0]!;
		return fail("page_patch_invalid", `page-patch/v1 ${first.keyword} failed. Send ops only (set, set_items, add, replace, remove, move, set_page, set_variant).`, first.path);
	}
	const patch = ctx.patch as { baseRevision?: number; ops: PatchOp[] };
	if (typeof patch.baseRevision === "number" && patch.baseRevision !== ctx.expectedRevision) {
		return fail("revision_conflict", "The page changed since this patch was made. Read currentPage again.", "$.baseRevision");
	}
	const base = ctx.page;
 if (ctx.scopeBlockIds?.length) {
  const allowed = new Set(ctx.scopeBlockIds);
  const scopedOps = (patch as { ops: Array<Record<string, unknown>> }).ops;
  const bad = scopedOps.findIndex(op => !['set','set_variant','set_items','replace','remove'].includes(String(op.op)) || typeof op.blockId !== 'string' || !allowed.has(op.blockId));
  if (bad >= 0) return fail('outside_scope', 'Only the explicitly selected block IDs may change. Clear the block scope to edit the whole page.', '$.ops[' + bad + ']');
 }
	const screenId = ctx.provenance?.screenId ?? null;
	const screen = screenId ? getScreenById(screenId) : null;
	const scenarioId = ctx.provenance?.scenarioId ?? null;
	const demoAllowed = ctx.demoData === true || (ctx.demoData !== false && (Boolean(ctx.sessionDemoData) || hasDemoBadge(base.layout.blocks)));
	const demoLabel = base.layout.blocks.map((node) => node.copy?.badge).find(Boolean) ?? demoLabelForLocale(ctx.demoLabel, base.locale) ?? defaultDemoLabel(base.locale);
	const english = base.locale.toLowerCase().split("-")[0] === "en";

	let blocks: PageBlock[] = structuredClone(base.layout.blocks);
	let title = base.title;
	const seo = { ...base.seo };
	const changed = new Set<string>();
	const added: string[] = [];
	const removed: string[] = [];
	const applied: string[] = [];
	let shellAdded = false;
	const swapNotes: string[] = [];

	const fromCatalog = (kind: PageBlockKind, at: string, op: PatchOp): PageBlock | Failure => {
		if (CHILD_ONLY_KINDS.has(kind)) return fail("slot_no_rows", `${kind} is a row kind; use set_items on its list block.`, `${at}.kind`);
		if (!screen) return fail("screen_unknown", "The page has no recorded Stock screen, so blocks cannot be added. Use propose_layout.", `${at}.kind`);
		// ADR 0027: the screen family is advisory; a kind from another family is sampled there. Unknown kinds stay out.
		const source = familyLabelForKind(screen, kind) ? null : kindSourceFor(screen, kind);
		if (!familyLabelForKind(screen, kind) && !source) {
			return fail("block_not_in_catalog", `No Stock screen has a ${kind} block. Not invented.`, `${at}.kind`);
		}
		const sampleScreen = source ? (getScreenById(source.screenId) ?? screen) : screen;
		if (!english && typeof op.title !== "string") {
			return fail("slot_required", `The page language is ${base.locale}: send title (and copy) for the new ${kind} block.`, `${at}.title`);
		}
		let node = attachCatalogSources([stockBlockFor(kind, { screen: sampleScreen, scenarioId: source ? null : scenarioId, brief: ctx.brief ?? title, pageTitle: title })], sampleScreen)[0]!;
		if (typeof op.variant === "string") {
			const choice = resolveCatalogChoice({ kind, catalogBlock: node.catalogBlock, variant: op.variant });
			if (!choice.ok) return fail(choice.code, choice.message, `${at}.variant`);
			node = { ...node, variant: op.variant };
		}
		const copy = op.copy as Record<string, string> | undefined;
		if (copy) {
			const bad = checkCopy(kind, copy, `${at}.copy`);
			if (bad) return bad;
			node = withCopy(node, copy);
		}
		if (typeof op.title === "string") node = { ...node, title: op.title };
		if (Array.isArray(op.items)) {
			if (DATA_KINDS.has(kind) && op.items.length && !demoAllowed) {
				return fail("demo_data_not_requested", `${kind} rows are figures; the author did not ask for demo data.`, `${at}.items`);
			}
			const rows = rowsFor(node, op.items as Item[], `${at}.items`);
			if (!Array.isArray(rows)) return rows;
			node = { ...node, children: rows };
			if (DATA_KINDS.has(kind) && rows.length) node = { ...node, copy: { ...node.copy, badge: demoLabel } };
		}
		return localizeEmptyLedes([node], base.locale)[0]!;
	};

	for (const [i, op] of patch.ops.entries()) {
		const at = `$.ops[${i}]`;
		const blockId = typeof op.blockId === "string" ? op.blockId : null;
		const found = blockId ? locate(blocks, blockId) : null;
		if (blockId && !found) return fail("block_not_found", `No block ${blockId} on the current page.`, `${at}.blockId`);
		const target = found ? found.list[found.index]! : null;

		if (op.op === "set" && target && found) {
			const field = String(op.field);
			const value = op.value as string | null;
			if (field === "title" || field === "summary") {
				if (value === null || !value.trim()) return fail("slot_required", `${field} cannot be empty.`, `${at}.value`);
				const max = field === "title" ? PAGE_LIMITS.maxTitleLength : PAGE_LIMITS.maxSummaryLength;
				found.list[found.index] = { ...target, [field]: value.slice(0, max) };
			} else {
				if (!(slotOf(target.kind).copy as string[]).includes(field)) {
					return fail("slot_not_rendered", `${target.kind} does not render copy.${field}. Slots: ${(slotOf(target.kind).copy as string[]).join(", ")}.`, `${at}.field`);
				}
				const copy: PageBlockCopy = { ...target.copy };
				if (value === null) delete copy[field as PageCopyKey];
				else copy[field as PageCopyKey] = value;
				const next: PageBlock = { ...target, copy };
				if (!Object.keys(copy).length) delete next.copy;
				found.list[found.index] = next;
			}
			changed.add(target.kind);
		} else if (op.op === "set_items" && target && found) {
			const items = op.items as Item[];
			if (DATA_KINDS.has(target.kind) && items.length && !demoAllowed) {
				return fail("demo_data_not_requested", `${target.kind} rows are figures; the author did not ask for demo data.`, `${at}.items`);
			}
			const rows = rowsFor(target, items, `${at}.items`);
			if (!Array.isArray(rows)) return rows;
			const next: PageBlock = { ...target, children: rows };
			if (!rows.length) delete next.children;
			if (DATA_KINDS.has(target.kind) && rows.length) next.copy = { ...next.copy, badge: demoLabel };
			found.list[found.index] = next;
			changed.add(target.kind);
		} else if (op.op === "add") {
			const kind = op.kind as PageBlockKind;
			if (walk(blocks).some((node) => node.kind === kind)) {
				return fail("block_exists", `The page already has a ${kind} block. Use set or replace.`, `${at}.kind`);
			}
			const node = fromCatalog(kind, at, op);
			if ("ok" in node) return node;
			const index = typeof op.at === "number" ? Math.min(op.at, blocks.length) : naturalIndexFor(kind, blocks);
			blocks.splice(index, 0, node);
			added.push(kind);
			if (kind === "sidenav" || kind === "bottomnav") shellAdded = true;
		} else if (op.op === "replace" && target && found && typeof op.catalogBlock === "string") {
			// Another Stock catalog block in the same place (ADR 0023): same kind, text carried by the props mapping.
			if (found.parent) return fail("not_top_level", "replace works on top-level blocks; use set_items for rows.", `${at}.blockId`);
			if (typeof op.kind === "string" && op.kind !== target.kind) {
				return fail("catalog_block_kind_mismatch", `replace with catalogBlock keeps the block's kind ${target.kind}; ${op.kind} is another page role.`, `${at}.kind`);
			}
			const swap = swapCatalogBlock(target, { catalogBlock: op.catalogBlock, variant: typeof op.variant === "string" ? op.variant : null });
			if (!swap.ok) return fail(swap.code, swap.message, swap.code === "unknown_variant" ? `${at}.variant` : `${at}.catalogBlock`);
			let node = swap.node;
			const copy = op.copy as Record<string, string> | undefined;
			if (copy) {
				const bad = checkCopy(target.kind, copy, `${at}.copy`);
				if (bad) return bad;
				node = withCopy(node, copy);
			}
			if (typeof op.title === "string") node = { ...node, title: op.title };
			if (Array.isArray(op.items)) {
				const rows = rowsFor(node, op.items as Item[], `${at}.items`);
				if (!Array.isArray(rows)) return rows;
				node = { ...node, children: rows };
			}
			found.list[found.index] = node;
			changed.add(target.kind);
			if (swap.dropped.length) swapNotes.push(`${target.id} -> ${node.catalogBlock}${node.variant ? `/${node.variant}` : ""}: not shown by the new block, dropped: ${swap.dropped.join(", ")}.`);
		} else if (op.op === "replace" && target && found) {
			if (found.parent) return fail("not_top_level", "replace works on top-level blocks; use set_items for rows.", `${at}.blockId`);
			const kind = op.kind as PageBlockKind;
			if (kind !== target.kind && walk(blocks).some((node) => node.kind === kind)) {
				return fail("block_exists", `The page already has a ${kind} block.`, `${at}.kind`);
			}
			const node = fromCatalog(kind, at, op);
			if ("ok" in node) return node;
			// Ids of the outgoing block are free once it is gone; every other id must stay unique.
			const outgoing = new Set(walk([target]).map((n) => n.id));
			const others = new Set(walk(blocks).map((n) => n.id).filter((id) => !outgoing.has(id)));
			if (walk([node]).some((n) => others.has(n.id))) return fail("duplicate_id", "Replacement block ids collide with the page.", at);
			found.list[found.index] = node;
			removed.push(target.kind);
			added.push(kind);
			if (kind === "sidenav" || kind === "bottomnav") shellAdded = true;
		} else if (op.op === "remove" && target && found) {
			found.list.splice(found.index, 1);
			if (found.parent) changed.add(found.parent.kind);
			else removed.push(target.kind);
		} else if (op.op === "move" && target && found) {
			const to = op.to as number;
			if (to >= found.list.length) return fail("index_out_of_range", `to must be below ${found.list.length}.`, `${at}.to`);
			found.list.splice(found.index, 1);
			found.list.splice(to, 0, target);
			changed.add(found.parent ? found.parent.kind : "order");
		} else if (op.op === "set_variant" && target && found) {
			if (found.parent) return fail("not_top_level", "set_variant works on top-level blocks.", `${at}.blockId`);
			const sourced = attachCatalogSources([target], screen)[0]!;
			if (!sourced.catalogBlock) return fail("unknown_catalog_block", `${target.kind} has no Stock catalog block on this page's screen.`, `${at}.blockId`);
			const variant = op.variant as string | null;
			const next: PageBlock = { ...sourced };
			if (variant === null) {
				const source = catalogSourceFor(sourced.catalogBlock);
				if (source) next.variant = source.defaultVariant;
				else delete next.variant;
			} else {
				const choice = resolveCatalogChoice({ kind: target.kind, catalogBlock: sourced.catalogBlock, variant });
				if (!choice.ok) return fail(choice.code, choice.message, `${at}.variant`);
				next.variant = variant;
			}
			// The chosen variant sets the layout axes: their props overrides go; content overrides stay (page-spec 1.3.0).
			const carried = stripAxisOverrides(next, target);
			const gone = [...carried.axes, ...carried.dropped];
			if (gone.length) swapNotes.push(`${target.id}: props overrides replaced by the variant ${variant ?? "default"} or not in it, dropped: ${gone.join(", ")}.`);
			found.list[found.index] = carried.node;
			changed.add(target.kind);
		} else if (op.op === "set_page") {
			const value = String(op.value);
			if (op.field === "title") title = value.slice(0, PAGE_LIMITS.maxTitleLength);
			else if (op.field === "seo.title") seo.title = value.slice(0, PAGE_LIMITS.maxSeoLength);
			else seo.description = value.slice(0, PAGE_LIMITS.maxSeoLength);
			changed.add("page");
		} else {
			return fail("page_patch_invalid", `Unsupported operation ${op.op}.`, `${at}.op`);
		}
		applied.push(`${op.op}${blockId ? ` ${blockId}` : typeof op.kind === "string" ? ` ${op.kind}` : ""}`);
	}

	if (shellAdded) blocks = arrangeShell(blocks, base.locale).blocks;
	blocks = attachCatalogSources(blocks, screen);
	const stamp = ctx.now ?? new Date().toISOString();
	const raw = { ...base, title, seo, layout: { version: base.layout.version, blocks }, updatedAt: stamp };
	let page: Page;
	try {
		page = parsePageSpec(raw, { draft: base.status === "draft" });
	} catch (err) {
		const rec = err as { code?: string; path?: string; message?: string };
		return fail(rec.code ?? "invalid_proposal", rec.message ?? "patched page failed validation", rec.path);
	}
	const checked = validateCatalogProvenance({ page, screenId, catalogDigest: catalogProvenance().sourceDigest });
	if (!checked.ok) return checked;
	const topKinds = page.layout.blocks.map((node) => node.kind);
	const demo = hasDemoBadge(page.layout.blocks);
	const intent: ProposalIntent = {
		locale: page.locale,
		localeSource: "page",
		...(typeof ctx.demoData === "boolean" ? { demoData: ctx.demoData } : {}),
		demoDataSource: ctx.demoData === true ? "model" : ctx.sessionDemoData ? "session" : demo ? "page" : "none",
		requireBlocks: [],
		unknownBlocks: [],
		remove: removed,
		newPage: false
	};
	return {
		ok: true,
		status: "proposal",
		applied: false,
		source: ctx.liveTurn ? "xai-runtime" : "local-catalog-assembler",
		liveModel: Boolean(ctx.liveTurn),
		page,
		baseRevision: ctx.expectedRevision,
		warnings: [`page-patch/v1 applied: ${applied.join("; ")}.`, ...swapNotes],
		inspected: [],
		missing: ctx.provenance?.missing ?? [],
		diff: {
			added,
			removed,
			changed: [...changed].filter((kind) => !added.includes(kind)),
			kept: topKinds.filter((kind) => !added.includes(kind) && !changed.has(kind))
		},
		demoData: demo,
		catalogRefs: checked.refs,
		provenance: {
			policyVersion: POLICY_VERSION,
			modelCatalogVersion: MODEL_CATALOG_VERSION,
			trialPolicyVersion: TRIAL_POLICY_VERSION,
			catalog: catalogProvenance(),
			scenarioId,
			screenId,
			assembler: "page-patch/v1",
			intent
		}
	};
}


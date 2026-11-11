/**
 * Build inspector model (ADR 0014): the fields of one page block, straight from the pinned props schema of its
 * registry item (registry/props.v0.json), with the values the preview renders (`organismFor(block).props`) and, per
 * field, the page-spec field an edit is written back to. No hand-written field lists or hints: names, kinds, enums
 * and requiredness come from the schema; a field without a page-spec origin is shown read-only (the variant or the
 * schema default sets it). Pure data, no Svelte.
 */
import { PAGE_LIMITS, PAGE_SLOTS, parsePageSpec, type Page, type PageBlock, type PageBlockCopy, type PageBlockKind, type PageCopyKey } from "@buildytech/page-contract";
import { arrangeShell, CHILD_ONLY_KINDS, localizeEmptyLedes, proposeLayout, stockBlockFor } from "./assemble.ts";
import { swapCatalogBlock } from "./block-swap.ts";
import { getScreenById } from "./catalog/search.ts";
import { catalogEntryBySpec, catalogSourceFor } from "./catalog/sources.ts";
import { registryItemFor } from "./catalog/organism.ts";
import { editPage } from "./patch.ts";
import { attachCatalogSources, familyLabelForKind, validateCatalogProvenance } from "./catalog/provenance.ts";
import { isScenarioId } from "./brief.ts";
import type { ScenarioId } from "./copy.ts";
import { organismFor, writableOrigin, type OrganismRender } from "./catalog/organism.ts";
import { checkBlockProps } from "./catalog/provenance.ts";
import { propsEventsFor, propsFieldTree, type PropsFieldNode } from "./catalog/props-schema.ts";
import { catalogVariantsFor } from "./catalog/sources.ts";

export type InspectorWidget = "text" | "longtext" | "icon" | "enum" | "boolean" | "number" | "object" | "list" | "other";

export type InspectorField = {
	/** JSON Pointer of the prop in the block's render props (`/title`, `/features/2/icon`). */
	pointer: string;
	name: string;
	widget: InspectorWidget;
	required: boolean;
	value: unknown;
	/** Page-spec field an edit writes (`copy.headline`, `children[2].copy.icon`); null: read-only. */
	origin: string | null;
	/** enum: the schema's values. */
	options?: string[];
	maxLength?: number;
	/** object: its fields. */
	fields?: InspectorField[];
	/** list of records: one entry per row, with the row's page-spec origin (`children[2]`) when it is a page row. */
	rows?: Array<{ pointer: string; origin: string | null; fields: InspectorField[] }>;
};

export type InspectorModel =
	| {
			ok: true;
			blockId: string;
			kind: string;
			title: string;
			catalogBlock: string;
			item: string;
			variant: string;
			/** Variants the catalog block offers (set_variant). */
			variants: string[];
			fields: InspectorField[];
	  }
	| { ok: false; blockId: string; kind: string; title: string; reason: "not_in_registry" | "no_schema" };

/** Never edited in the inspector: identity and host wiring. */
const HIDDEN = new Set(["id", "class", "className"]);
/** Page-spec origins of long text (a summary / lede) get a multi-line widget. */
const LONG_ORIGIN = /(?:^|\.)(?:summary|copy\.lede)$/;
const LONG_TEXT = 200;

function valueAt(data: unknown, pointer: string): unknown {
	let current = data;
	for (const part of pointer.split("/").slice(1)) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

function widgetFor(node: PropsFieldNode, origin: string | null): InspectorWidget {
	switch (node.kind) {
		case "text":
			return (origin && LONG_ORIGIN.test(origin)) || (node.maxLength ?? 0) > LONG_TEXT ? "longtext" : "text";
		case "icon":
		case "enum":
		case "boolean":
		case "number":
		case "object":
			return node.kind;
		case "list":
			return node.fields ? "list" : "other";
		default:
			return "other";
	}
}

function fieldsOf(block: PageBlock, render: OrganismRender, nodes: PropsFieldNode[], base: string, hidden: ReadonlySet<string>): InspectorField[] {
	const out: InspectorField[] = [];
	for (const node of nodes) {
		if (HIDDEN.has(node.name) || hidden.has(node.name)) continue;
		const pointer = `${base}/${node.name}`;
		const origin = writableOrigin(block, render, pointer);
		const field: InspectorField = {
			pointer,
			name: node.name,
			widget: widgetFor(node, origin),
			required: node.required,
			value: valueAt(render.props, pointer),
			origin
		};
		if (node.enum) field.options = node.enum;
		if (node.maxLength !== undefined) field.maxLength = node.maxLength;
		if (field.widget === "object" && node.fields) field.fields = fieldsOf(block, render, node.fields, pointer, new Set());
		if (field.widget === "list" && node.fields) {
			const rows = Array.isArray(field.value) ? field.value : [];
			field.rows = rows.map((_, index) => {
				const at = `${pointer}/${index}`;
				const row = render.origins[at];
				return { pointer: at, origin: row && /^children\[\d+\]$/.test(row) ? row : null, fields: fieldsOf(block, render, node.fields!, at, new Set()) };
			});
		}
		out.push(field);
	}
	return out;
}

/** The inspector fields of a page block, or an honest stub when it has no registry item or no published schema. */
export function inspectorModel(block: PageBlock): InspectorModel {
	const head = { blockId: block.id, kind: block.kind, title: block.title };
	const render = organismFor(block);
	if (!render) return { ok: false, ...head, reason: "not_in_registry" };
	const tree = propsFieldTree(render.item);
	if (!tree) return { ok: false, ...head, reason: "no_schema" };
	const { events, slots } = propsEventsFor(render.item);
	return {
		ok: true,
		...head,
		catalogBlock: render.catalogBlock,
		item: render.item,
		variant: render.variant,
		variants: catalogVariantsFor(render.catalogBlock),
		fields: fieldsOf(block, render, tree, "", new Set([...events, ...slots]))
	};
}

// ---- Write-back (step 3) ----------------------------------------------------------------------------------------

export type InspectorFailure = {
	ok: false;
	code: string;
	message: string;
	/** The field the rejection belongs to (JSON Pointer of the render props). */
	pointer: string;
	/** enum / icon rejections: every allowed value of the schema. */
	allowed?: string[];
};
export type InspectorSuccess = { ok: true; page: Page; /** The block to keep selected. */ blockId: string };
export type InspectorResult = InspectorSuccess | InspectorFailure;

const fail = (code: string, message: string, pointer: string, allowed?: string[]): InspectorFailure =>
	allowed?.length ? { ok: false, code, message, pointer, allowed } : { ok: false, code, message, pointer };

const ORIGIN = /^((?:children\[\d+\]\.)*)(title|summary|copy\.([a-z]+))$/;

/** The block with `origin` (`copy.headline`, `children[2].copy.icon`, `title`) set to `value`; other fields kept. */
export function writeOrigin(block: PageBlock, origin: string, value: string): PageBlock | null {
	const match = ORIGIN.exec(origin);
	if (!match) return null;
	const path = [...match[1]!.matchAll(/children\[(\d+)\]\./g)].map((hit) => Number(hit[1]));
	const field = match[2]!;
	const set = (node: PageBlock, depth: number): PageBlock | null => {
		if (depth < path.length) {
			const index = path[depth]!;
			const child = node.children?.[index];
			if (!child) return null;
			const next = set(child, depth + 1);
			if (!next) return null;
			const children = [...node.children!];
			children[index] = next;
			return { ...node, children };
		}
		if (field === "title" || field === "summary") return { ...node, [field]: value };
		const copy: PageBlockCopy = { ...node.copy, [match[3]! as PageCopyKey]: value };
		return { ...node, copy };
	};
	return set(block, 0);
}

/** `next` with every top-level block that did not change replaced by the object of `prev` (only changed blocks re-render). */
export function shareUnchanged(prev: Page, next: Page): Page {
	const before = new Map(prev.layout.blocks.map((node) => [node.id, node]));
	const blocks = next.layout.blocks.map((node) => {
		const old = before.get(node.id);
		return old && JSON.stringify(old) === JSON.stringify(node) ? old : node;
	});
	return { ...next, layout: { ...next.layout, blocks } };
}

type Issue = { pointer: string; message: string; allowed?: unknown[]; value?: unknown };

/**
 * The inspector gate: the page-spec schema + parsePage program checks on the whole page, then the props gate (Ajv
 * 2020 over the published schema, fail closed) on every changed top-level block. Nothing is written on failure.
 */
export function gateInspectorPage(base: Page, blocks: PageBlock[], changed: readonly string[], pointer: string, now?: string): InspectorFailure | { ok: true; page: Page } {
	let page: Page;
	try {
		page = parsePageSpec({ ...base, layout: { ...base.layout, blocks }, updatedAt: now ?? new Date().toISOString() }, { draft: base.status === "draft" });
	} catch (err) {
		const rec = err as { code?: string; path?: string; message?: string };
		return fail(rec.code ?? "page_spec_invalid", rec.message ?? "The page does not match page-spec/v1.", pointer);
	}
	for (const id of changed) {
		const index = page.layout.blocks.findIndex((node) => node.id === id);
		if (index < 0) continue;
		const error = checkBlockProps(page.layout.blocks[index]!, `layout.blocks[${index}]`);
		if (!error) continue;
		const issues = ((error as { issues?: Issue[] }).issues ?? []) as Issue[];
		const issue = issues.find((row) => row.pointer === pointer) ?? issues[0];
		if (!issue) return fail(error.code, error.message, pointer);
		const value = issue.value !== undefined ? ` ${JSON.stringify(issue.value)}` : "";
		return fail(error.code, `${issue.pointer || "(props)"}${value}: ${issue.message}.`, issue.pointer || pointer, issue.allowed?.map(String));
	}
	return { ok: true, page: shareUnchanged(base, page) };
}

/**
 * Write one inspector field back to the page: the field's page-spec origin (override only; variant presets and
 * schema defaults are never copied into the page), then the inspector gate. On failure the page is unchanged and
 * the result names the field, the reason and, for an enum, the allowed values.
 */
export function inspectorSetField(page: Page, blockId: string, pointer: string, value: string, now?: string): InspectorResult {
	const index = page.layout.blocks.findIndex((node) => node.id === blockId);
	const block = page.layout.blocks[index];
	if (!block) return fail("block_not_found", `No section ${blockId} on this page.`, pointer);
	const render = organismFor(block);
	if (!render) return fail("not_in_registry", `Section ${blockId} has no registry block.`, pointer);
	const origin = writableOrigin(block, render, pointer);
	if (!origin) return fail("field_not_editable", `${pointer} is set by the variant ${render.variant}, not by the page.`, pointer);
	const next = writeOrigin(block, origin, value);
	if (!next) return fail("field_not_editable", `${pointer} has no page field ${origin}.`, pointer);
	// Writing the value the page already has is a no-op: same page, no history step, no revision.
	if (JSON.stringify(next) === JSON.stringify(block)) return { ok: true, page, blockId };
	const blocks = [...page.layout.blocks];
	blocks[index] = next;
	const gated = gateInspectorPage(page, blocks, [blockId], pointer, now);
	return gated.ok ? { ok: true, page: gated.page, blockId } : gated;
}

// ---- Block operations (step 4) ---------------------------------------------------------------------------------

/** `add`: a Stock block variant from the Blocks feed, after `blockId` (a section, or one of its rows) or at the end (""). */
export type InspectorOp =
	| { op: "set_variant"; blockId: string; variant: string }
	| { op: "reset"; blockId: string }
	| { op: "move"; blockId: string; to: number }
	| { op: "duplicate"; blockId: string }
	| { op: "remove"; blockId: string }
	| { op: "duplicate_row"; blockId: string; row: number }
	| { op: "remove_row"; blockId: string; row: number }
	| { op: "add"; blockId: string; catalogBlock: string; variant?: string | null };

export type InspectorOpContext = {
	page: Page;
	provenance: { screenId: string | null; scenarioId: string | null; missing?: string[] } | null;
	revision: number;
	now?: string;
};

function walkIds(blocks: readonly PageBlock[], out = new Set<string>()): Set<string> {
	for (const node of blocks) {
		out.add(node.id);
		walkIds(node.children ?? [], out);
	}
	return out;
}

/** A free id derived from `id` (`block-hero-copy`, `block-hero-copy-2`, ...), within the page-spec id length. */
function freeId(id: string, taken: Set<string>): string {
	for (let n = 1; ; n += 1) {
		const suffix = n === 1 ? "-copy" : `-copy-${n}`;
		const candidate = `${id.slice(0, PAGE_LIMITS.maxIdLength - suffix.length)}${suffix}`;
		if (!taken.has(candidate)) {
			taken.add(candidate);
			return candidate;
		}
	}
}

/** A copy of a block (and its rows) with fresh ids that do not collide with the page. */
function cloneWithIds(node: PageBlock, taken: Set<string>): PageBlock {
	const copy: PageBlock = { ...structuredClone(node), id: freeId(node.id, taken) };
	if (node.children?.length) copy.children = node.children.map((child) => cloneWithIds(child, taken));
	return copy;
}

type PatchProvenance = Parameters<typeof editPage>[0]["provenance"];

function patchProvenance(ctx: InspectorOpContext): PatchProvenance {
	if (!ctx.provenance) return undefined;
	const scenarioId: ScenarioId | null = isScenarioId(ctx.provenance.scenarioId) ? ctx.provenance.scenarioId : null;
	return { screenId: ctx.provenance.screenId, scenarioId, missing: ctx.provenance.missing ?? [] } as PatchProvenance;
}

/** A page-patch/v1 operation through editPage: the published schema, slot checks and the catalog provenance gate. */
function viaPatch(ctx: InspectorOpContext, op: Record<string, unknown>, select: string): InspectorResult {
	const result = editPage({ page: ctx.page, provenance: patchProvenance(ctx), patch: { ops: [op] }, expectedRevision: ctx.revision, now: ctx.now });
	if (!result.ok) return fail(result.code, result.message, "");
	return { ok: true, page: shareUnchanged(ctx.page, result.page), blockId: select };
}

/** The Stock sample of a block: the same screen assembled with no page content, the block with the same id. */
function stockSample(ctx: InspectorOpContext, block: PageBlock): PageBlock | null {
	const screenId = ctx.provenance?.screenId ?? null;
	if (!screenId) return null;
	const scenarioId = isScenarioId(ctx.provenance?.scenarioId) ? ctx.provenance!.scenarioId : null;
	const fresh = proposeLayout({
		brief: ctx.page.title,
		scenarioId,
		screenId,
		expectedRevision: 0,
		now: ctx.now,
		content: { locale: ctx.page.locale, blocks: [] }
	});
	if (!fresh.ok) return null;
	const sample = fresh.page.layout.blocks.find((node) => node.id === block.id && node.catalogBlock === block.catalogBlock);
	return sample ? { ...sample, ...(block.variant ? { variant: block.variant } : {}) } : null;
}

/** A local tree operation under the inspector gate, plus the catalog provenance gate when the page has a screen. */
function gated(ctx: InspectorOpContext, blocks: PageBlock[], changed: string[], select: string): InspectorResult {
	const result = gateInspectorPage(ctx.page, blocks, changed, "", ctx.now);
	if (!result.ok) return result;
	const screenId = ctx.provenance?.screenId ?? null;
	if (screenId) {
		const checked = validateCatalogProvenance({ page: result.page, screenId });
		if (!checked.ok) return fail(checked.code, checked.message, "");
	}
	return { ok: true, page: result.page, blockId: select };
}

/** Why the Blocks feed cannot add this block to the page (null: it can). Cheap: the op runs every gate again. */
export type AddBlockCheck = { ok: true; kind: PageBlockKind; variant: string | null } | { ok: false; code: "no_page" | "no_screen" | "unknown_block" | "not_a_page_block" | "not_in_screen_family" | "unknown_variant" | "no_renderer"; message: string };

export function canAddCatalogBlock(ctx: Pick<InspectorOpContext, "page" | "provenance"> | { page: null; provenance: null }, catalogBlock: string, variant?: string | null): AddBlockCheck {
	if (!ctx.page) return { ok: false, code: "no_page", message: "There is no page yet: build one first." };
	const entry = catalogEntryBySpec(catalogBlock);
	if (!entry?.available) return { ok: false, code: "unknown_block", message: `${catalogBlock} is not a Stock catalog block.` };
	const kind = entry.rendererCompatible && entry.rendererKind ? (entry.rendererKind as PageBlockKind) : null;
	if (!kind || CHILD_ONLY_KINDS.has(kind)) return { ok: false, code: "not_a_page_block", message: `${catalogBlock} has no page section renderer in this BuildY version yet.` };
	const want = variant ?? catalogSourceFor(catalogBlock)?.defaultVariant ?? null;
	if (want && !entry.variants.includes(want)) return { ok: false, code: "unknown_variant", message: `${catalogBlock} has no variant ${want}.` };
	const screen = ctx.provenance?.screenId ? getScreenById(ctx.provenance.screenId) : null;
	if (!screen) return { ok: false, code: "no_screen", message: "The page has no recorded Stock screen, so blocks cannot be added." };
	if (!familyLabelForKind(screen, kind)) {
		return { ok: false, code: "not_in_screen_family", message: `Stock screen ${screen.screenId} and its family have no ${kind} section.` };
	}
	if (!registryItemFor(catalogBlock, want)) return { ok: false, code: "no_renderer", message: `${catalogBlock} has no page renderer in this BuildY version yet.` };
	return { ok: true, kind, variant: want };
}

/** Ids of `node` and its rows made unique against `taken` (`block-hero` -> `block-hero-2`), within the id length. */
function withFreshIds(node: PageBlock, taken: Set<string>): PageBlock {
	const fresh = (id: string) => {
		if (!taken.has(id)) {
			taken.add(id);
			return id;
		}
		for (let n = 2; ; n += 1) {
			const suffix = `-${n}`;
			const candidate = `${id.slice(0, PAGE_LIMITS.maxIdLength - suffix.length)}${suffix}`;
			if (!taken.has(candidate)) {
				taken.add(candidate);
				return candidate;
			}
		}
	};
	const copy: PageBlock = { ...node, id: fresh(node.id) };
	if (node.children?.length) copy.children = node.children.map((child) => withFreshIds(child, taken));
	return copy;
}

/** The Stock sample of a catalog block variant as a new section of this page (the page's Stock screen family). */
function addedBlock(ctx: InspectorOpContext, catalogBlock: string, variant: string | null): PageBlock | InspectorFailure {
	const check = canAddCatalogBlock(ctx, catalogBlock, variant);
	if (!check.ok) return fail(check.code, check.message, "");
	const screen = getScreenById(ctx.provenance!.screenId!)!;
	const scenarioId: ScenarioId | null = isScenarioId(ctx.provenance?.scenarioId) ? ctx.provenance!.scenarioId : null;
	let node = attachCatalogSources([stockBlockFor(check.kind, { screen, scenarioId, brief: ctx.page.title, pageTitle: ctx.page.title })], screen)[0]!;
	if (node.catalogBlock !== catalogBlock || (node.variant ?? null) !== check.variant) {
		const swap = swapCatalogBlock(node, { catalogBlock, variant: check.variant });
		if (!swap.ok && swap.code !== "no_change") return fail(swap.code, swap.message, "", swap.allowed);
		if (swap.ok) node = swap.node;
	}
	return localizeEmptyLedes([node], ctx.page.locale)[0]!;
}

/**
 * Block operations of the inspector. Variant, move and remove are page-patch/v1 operations (editPage); reset puts
 * back the Stock sample of the block in its current variant; duplicate and the row operations are local tree edits.
 * Every result passes page-spec, the props gate and (with a screen) the catalog provenance gate, or nothing changes.
 */
export function inspectorOp(ctx: InspectorOpContext, op: InspectorOp): InspectorResult {
	const blocks = ctx.page.layout.blocks;
	if (op.op === "add") {
		// After the selected section (a row counts as its section), else at the end; then every gate, or nothing changes.
		const anchor = op.blockId ? blocks.findIndex((node) => node.id === op.blockId || walkIds([node]).has(op.blockId)) : -1;
		if (op.blockId && anchor < 0) return fail("block_not_found", `No section ${op.blockId} on this page.`, "");
		const made = addedBlock(ctx, op.catalogBlock, op.variant ?? null);
		if ("ok" in made) return made;
		const node = withFreshIds(made, walkIds(blocks));
		let next = [...blocks];
		next.splice(anchor < 0 ? blocks.length : anchor + 1, 0, node);
		if (node.kind === "sidenav" || node.kind === "bottomnav") next = arrangeShell(next, ctx.page.locale).blocks;
		return gated(ctx, next, [node.id], node.id);
	}
	const index = blocks.findIndex((node) => node.id === op.blockId);
	const block = blocks[index];
	if (!block) return fail("block_not_found", `No section ${op.blockId} on this page.`, "");
	switch (op.op) {
		case "set_variant":
			if (op.variant === block.variant) return { ok: true, page: ctx.page, blockId: block.id };
			return viaPatch(ctx, { op: "set_variant", blockId: block.id, variant: op.variant }, block.id);
		case "move":
			if (op.to < 0 || op.to >= blocks.length) return fail("index_out_of_range", `A section moves to 1..${blocks.length}.`, "");
			if (op.to === index) return { ok: true, page: ctx.page, blockId: block.id };
			return viaPatch(ctx, { op: "move", blockId: block.id, to: op.to }, block.id);
		case "remove": {
			const neighbour = blocks[index + 1] ?? blocks[index - 1];
			return viaPatch(ctx, { op: "remove", blockId: block.id }, neighbour?.id ?? "");
		}
		case "reset": {
			const sample = stockSample(ctx, block);
			if (!sample) return fail("no_stock_sample", `Section ${block.id} has no Stock sample on this page's screen.`, "");
			const next = [...blocks];
			next[index] = sample;
			return gated(ctx, next, [block.id], block.id);
		}
		case "duplicate": {
			const copy = cloneWithIds(block, walkIds(blocks));
			const next = [...blocks];
			next.splice(index + 1, 0, copy);
			return gated(ctx, next, [copy.id], copy.id);
		}
		case "duplicate_row":
		case "remove_row": {
			const rows = block.children ?? [];
			const row = rows[op.row];
			if (!row) return fail("row_not_found", `Section ${block.id} has no row ${op.row + 1}.`, "");
			const nextRows = [...rows];
			if (op.op === "remove_row") nextRows.splice(op.row, 1);
			else {
				const max = PAGE_SLOTS[block.kind]?.items?.max ?? 0;
				if (rows.length >= max) return fail("rows_over_limit", `${block.kind} renders at most ${max} rows.`, "");
				nextRows.splice(op.row + 1, 0, cloneWithIds(row, walkIds(blocks)));
			}
			const nextBlock: PageBlock = { ...block, children: nextRows };
			if (!nextRows.length) delete nextBlock.children;
			const next = [...blocks];
			next[index] = nextBlock;
			return gated(ctx, next, [block.id], block.id);
		}
	}
}

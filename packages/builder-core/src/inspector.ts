/**
 * Build inspector model (ADR 0014): the fields of one page block, straight from the pinned props schema of its
 * registry item (registry/props.v0.json), with the values the preview renders (`organismFor(block).props`) and, per
 * field, the page-spec field an edit is written back to. No hand-written field lists or hints: names, kinds, enums
 * and requiredness come from the schema; a field without a page-spec origin is shown read-only (the variant or the
 * schema default sets it). Pure data, no Svelte.
 */
import { PAGE_LIMITS, PAGE_PROPS_LIMITS, PAGE_SLOTS, parsePageSpec, type PagePropValue, type Page, type PageBlock, type PageBlockCopy, type PageBlockKind, type PageCopyKey } from "@buildytech/page-contract";
import { arrangeShell, CHILD_ONLY_KINDS, localizeEmptyLedes, proposeLayout, stockBlockFor } from "./assemble.ts";
import { swapCatalogBlock } from "./block-swap.ts";
import { getScreenById } from "./catalog/search.ts";
import type { CatalogScreen } from "./catalog/types.ts";
import { catalogEntryBySpec, catalogSourceFor } from "./catalog/sources.ts";
import { registryItemFor } from "./catalog/organism.ts";
import { editPage } from "./patch.ts";
import { attachCatalogSources, FAMILY_HOME_SCREENS, familyLabelForKind, kindSourceFor, validateCatalogProvenance } from "./catalog/provenance.ts";
import { isScenarioId } from "./brief.ts";
import type { ScenarioId } from "./copy.ts";
import { organismFor, pageListName, variantPreset, writableOrigin, type OrganismRender } from "./catalog/organism.ts";
import { propsNodeAt, remapRowOverrides, valueAtPointer, withPropsOverride } from "./catalog/props-overrides.ts";
import { newPropsListRow } from "./catalog/props-schema.ts";
import { checkBlockProps } from "./catalog/provenance.ts";
import { addSlotCheck, chromeEdge, moveSlotCheck, walkIds, withFreshIds } from "./page-slots.ts";
import { propsEventsFor, propsFieldTree, type PropsFieldNode } from "./catalog/props-schema.ts";
import { catalogVariantsFor } from "./catalog/sources.ts";
import { screenSections } from "./catalog/screen-sections.ts";

export type InspectorLock = "variant" | "sample" | "no_page_field";

/** A copy key of the block kind that this registry block does not render (e.g. a hero eyebrow): shown, not edited. */
export type InspectorUnshown = { key: string; value: string | undefined };

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
	/**
	 * Why a field without an origin is locked: `variant` (a variant axis or a value the variant preset sets),
	 * `sample` (a placeholder the props schema fills in, e.g. "Title"), `no_page_field` (the page has no field for it
	 * yet). Absent on editable fields and on objects / lists (their fields carry their own reason).
	 */
	lock?: InspectorLock;
	/** Variant axis (top-level enum the variant presets set): per value, the named variant it switches to, or null. */
	choices?: Array<{ value: string; variant: string | null }>;
	/**
	 * Writable as a block props override (page-spec 1.3.0, `block.props[pointer]`): no copy slot maps the field, so an
	 * edit goes to the override map, validated against the item's props schema. Copy slots are preferred: a field
	 * with an `origin` never gets `prop`.
	 */
	prop?: boolean;
	/** Where the shown value of a `prop` field comes from until it is overridden (same reasons as `lock`). */
	from?: InspectorLock;
	/** The value comes from a props override (the pointer or a list / object above it is in `block.props`). */
	overridden?: boolean;
	/** list: where its rows live (page rows of the block, or a props override list) and how many it may hold. */
	list?: { source: "page" | "props"; max: number };
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
			/** Copy keys of the page block kind this registry block does not show. */
			unshown: InspectorUnshown[];
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

type Ctx = {
	block: PageBlock;
	render: OrganismRender;
	preset: Record<string, unknown>;
	axes: Record<string, Array<{ value: string; variant: string | null }>>;
	/** Top-level blocks take props overrides (page-spec 1.3.0); rows do not. */
	overridable: boolean;
};

const LEAF_WIDGETS = new Set<InspectorWidget>(["text", "longtext", "icon", "enum", "boolean", "number"]);

function lockFor(ctx: Ctx, field: InspectorField): InspectorLock | undefined {
	if (field.origin || field.widget === "object" || field.widget === "list") return undefined;
	if (field.choices || valueAt(ctx.preset, field.pointer) !== undefined) return "variant";
	const value = field.value;
	if (value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)) return "sample";
	return "no_page_field";
}

const coveredBy = (overrides: readonly string[], pointer: string): boolean => overrides.some((key) => pointer === key || pointer.startsWith(`${key}/`));

function fieldsOf(ctx: Ctx, nodes: PropsFieldNode[], base: string, hidden: ReadonlySet<string>): InspectorField[] {
	const { block, render } = ctx;
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
		if (base === "" && ctx.axes[node.name]) field.choices = ctx.axes[node.name];
		if (node.maxLength !== undefined) field.maxLength = node.maxLength;
		if (!origin && ctx.overridable && LEAF_WIDGETS.has(field.widget)) field.prop = true;
		if (coveredBy(render.overrides, pointer)) field.overridden = true;
		const lock = lockFor(ctx, field);
		if (lock && field.prop) {
			if (!field.overridden) field.from = lock;
		} else if (lock) field.lock = lock;
		if (field.widget === "object" && node.fields) field.fields = fieldsOf(ctx, node.fields, pointer, new Set());
		if (field.widget === "list" && node.fields) {
			const rows = Array.isArray(field.value) ? field.value : [];
			const source = pageRowList(block, render, pointer) ? "page" : ctx.overridable ? "props" : null;
			if (source) field.list = { source, max: source === "page" ? (PAGE_SLOTS[block.kind]?.items?.max ?? 0) : Math.min(node.maxItems ?? PAGE_PROPS_LIMITS.maxListItems, PAGE_PROPS_LIMITS.maxListItems) };
			field.rows = rows.map((_, index) => {
				const at = `${pointer}/${index}`;
				const row = render.origins[at];
				return { pointer: at, origin: row && /^children\[\d+\]$/.test(row) ? row : null, fields: fieldsOf(ctx, node.fields!, at, new Set()) };
			});
		}
		out.push(field);
	}
	return out;
}

/**
 * Whether a list prop holds the block's page rows (`children`): the one list content() maps rows into, on a kind
 * with rows, unless a props override replaced that list.
 */
function pageRowList(block: PageBlock, render: OrganismRender, pointer: string): boolean {
	if (coveredBy(render.overrides, pointer)) return false;
	if (Object.entries(render.origins).some(([key, from]) => key.startsWith(`${pointer}/`) && /^children\[\d+\]$/.test(from))) return true;
	if (!PAGE_SLOTS[block.kind]?.items) return false;
	return pageListName(render.item) === pointer.slice(1);
}

/**
 * Variant axes of a block: every top-level enum prop the variant presets set, each value mapped to the named catalog
 * variant whose preset equals the current one with only that axis changed (null when no named preset matches).
 */
function variantAxes(block: PageBlock, render: OrganismRender, current: Record<string, unknown>): Ctx["axes"] {
	const named: Array<{ variant: string; preset: Record<string, unknown> }> = [];
	for (const variant of catalogVariantsFor(render.catalogBlock)) {
		const hit = registryItemFor(block.catalogBlock, variant);
		if (hit?.item === render.item) named.push({ variant, preset: variantPreset(hit.item, hit.variant) });
	}
	const tree = propsFieldTree(render.item) ?? [];
	const keys = tree.filter((node) => node.kind === "enum" && named.some((entry) => entry.preset[node.name] !== undefined)).map((node) => node.name);
	const axisOf = (preset: Record<string, unknown>, key: string) => preset[key] ?? render.props[key];
	const axes: Ctx["axes"] = {};
	for (const key of keys) {
		const node = tree.find((entry) => entry.name === key)!;
		axes[key] = (node.enum ?? []).map((value) => {
			const want = (other: string) => (other === key ? value : axisOf(current, other));
			const hit = named.find((entry) => keys.every((other) => String(axisOf(entry.preset, other)) === String(want(other))));
			return { value, variant: hit?.variant ?? null };
		});
	}
	return axes;
}

/** Copy keys the page kind renders that no field of this registry block reads or writes (a hero-split has no eyebrow). */
function unshownCopy(block: PageBlock, fields: InspectorField[]): InspectorUnshown[] {
	const used = new Set<string>();
	const walk = (list: InspectorField[]) => {
		for (const field of list) {
			if (field.origin && !field.origin.startsWith("children[")) used.add(field.origin);
			walk(field.fields ?? []);
		}
	};
	walk(fields);
	// headline / lede are the block title / summary when the copy key is not set.
	if (used.has("title")) used.add("copy.headline");
	if (used.has("summary")) used.add("copy.lede");
	const keys = [...new Set([...((PAGE_SLOTS[block.kind]?.copy ?? []) as readonly string[]), ...Object.keys(block.copy ?? {})])];
	return keys
		.filter((key) => !used.has(`copy.${key}`) && (block.copy?.[key as PageCopyKey] !== undefined || (PAGE_SLOTS[block.kind]?.copy as readonly string[] | undefined)?.includes(key)))
		.map((key) => ({ key, value: block.copy?.[key as PageCopyKey] }));
}

/** The inspector fields of a page block, or an honest stub when it has no registry item or no published schema. */
export function inspectorModel(block: PageBlock): InspectorModel {
	const head = { blockId: block.id, kind: block.kind, title: block.title };
	const render = organismFor(block);
	if (!render) return { ok: false, ...head, reason: "not_in_registry" };
	const tree = propsFieldTree(render.item);
	if (!tree) return { ok: false, ...head, reason: "no_schema" };
	const { events, slots } = propsEventsFor(render.item);
	const preset = variantPreset(render.item, render.variant);
	const ctx: Ctx = { block, render, preset, axes: variantAxes(block, render, render.props), overridable: true };
	const fields = fieldsOf(ctx, tree, "", new Set([...events, ...slots]));
	return {
		ok: true,
		...head,
		catalogBlock: render.catalogBlock,
		item: render.item,
		variant: render.variant,
		variants: catalogVariantsFor(render.catalogBlock),
		fields,
		unshown: unshownCopy(block, fields)
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
export type InspectorSuccess = {
	ok: true;
	page: Page;
	/** The block to keep selected. */
	blockId: string;
	/** What the change did, for the session history (session 1.6.0); never the value. */
	op?: SessionRevisionOp;
	/** JSON Pointer of the field or row in the block's render props. */
	path?: string;
	/** Props overrides a variant switch or a swap could not carry (pointers). */
	dropped?: string[];
};

/** session 1.6.0 history op (the page-contract session entry is not imported here: the runtime bundle stays small). */
export type SessionRevisionOp = "set_field" | "set_variant" | "add" | "move" | "remove" | "insert" | "replace";
export type InspectorResult = InspectorSuccess | InspectorFailure;

const fail = (code: string, message: string, pointer: string, allowed?: string[]): InspectorFailure =>
	allowed?.length ? { ok: false, code, message, pointer, allowed } : { ok: false, code, message, pointer };

/** page-spec copy.href: `#fragment`, `/path`, an http(s) URL or mailto (the contract pattern). */
const LINK = /^(?:#|\/|https?:\/\/|mailto:)/;

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
	if (origin) {
		if (/(?:^|\.)copy\.href$/.test(origin) && !LINK.test(value)) {
			return fail("link_invalid", `${pointer} "${value}": a link starts with #, /, http://, https:// or mailto:.`, pointer);
		}
		const written = writeOrigin(block, origin, value);
		if (!written) return fail("field_not_editable", `${pointer} has no page field ${origin}.`, pointer);
		// A copy slot wins: an override left at the same pointer would hide the edit, so it goes.
		const next = block.props?.[pointer] !== undefined ? withPropsOverride(written, pointer, undefined) : written;
		return commitBlock(page, index, block, next, pointer, now);
	}
	// No copy slot maps it: the block props override map (page-spec 1.3.0), checked against the item's props schema.
	const node = propsNodeAt(render.item, pointer);
	if (!node || !["text", "icon", "enum", "boolean", "number"].includes(node.kind)) {
		return fail("field_not_editable", `${pointer} is not a field of ${render.item} the inspector can write.`, pointer);
	}
	const coerced = coerceProp(node, value);
	if (!coerced.ok) return fail(coerced.code, `${pointer} "${value}": ${coerced.message}`, pointer, coerced.allowed);
	if (typeof coerced.value === "string" && /href$/i.test(node.name) && coerced.value !== "" && !LINK.test(coerced.value)) {
		return fail("link_invalid", `${pointer} "${value}": a link starts with #, /, http://, https:// or mailto:.`, pointer);
	}
	return commitBlock(page, index, block, withPropsOverride(block, pointer, coerced.value), pointer, now);
}

/** A typed value for a schema field: enum values as the schema writes them (numbers stay numbers), numbers, booleans. */
function coerceProp(node: PropsFieldNode, value: string): { ok: true; value: PagePropValue } | { ok: false; code: string; message: string; allowed?: string[] } {
	if (node.kind === "enum") {
		const raw = (node.enumValues ?? node.enum ?? []).find((entry) => String(entry) === value);
		return raw === undefined ? { ok: false, code: "props_invalid", message: "not an allowed value.", allowed: node.enum } : { ok: true, value: raw };
	}
	if (node.kind === "number") {
		const number = Number(value);
		return value.trim() !== "" && Number.isFinite(number) ? { ok: true, value: number } : { ok: false, code: "props_invalid", message: "not a number." };
	}
	if (node.kind === "boolean") return { ok: true, value: value === "true" };
	return { ok: true, value };
}

function commitBlock(page: Page, index: number, block: PageBlock, next: PageBlock, pointer: string, now?: string): InspectorResult {
	// Writing the value the page already has is a no-op: same page, no history step, no revision.
	if (JSON.stringify(next) === JSON.stringify(block)) return { ok: true, page, blockId: block.id };
	const blocks = [...page.layout.blocks];
	blocks[index] = next;
	const gated = gateInspectorPage(page, blocks, [block.id], pointer, now);
	return gated.ok ? { ok: true, page: gated.page, blockId: block.id, op: "set_field", path: pointer } : gated;
}

// ---- Block operations (step 4) ---------------------------------------------------------------------------------

/**
 * `add`: a Stock block variant from the Blocks feed, after `blockId` (a section, or one of its rows) or at the end
 * (""); with `at` (a drop between sections, 0..sections) at that top-level slot instead, checked by addSlotCheck.
 */
export type InspectorOp =
	| { op: "set_variant"; blockId: string; variant: string }
	| { op: "reset"; blockId: string }
	| { op: "move"; blockId: string; to: number }
	| { op: "duplicate"; blockId: string }
	| { op: "remove"; blockId: string }
	| { op: "duplicate_row"; blockId: string; row: number }
	| { op: "remove_row"; blockId: string; row: number }
	| { op: "add"; blockId: string; catalogBlock: string; variant?: string | null; at?: number }
	/** A row of a list prop: page rows of the block (children) or a props override list (`/content/features`). */
	| { op: "list_row"; blockId: string; pointer: string; action: "add" | "remove" | "up" | "down"; row?: number };

export type InspectorOpContext = {
	page: Page;
	provenance: { screenId: string | null; scenarioId: string | null; missing?: string[] } | null;
	revision: number;
	now?: string;
};

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
export type AddBlockCheck =
	| { ok: true; kind: PageBlockKind; variant: string | null; /** Set when there is no page yet: the Stock screen the empty page starts on. */ startScreenId?: string }
	| { ok: false; code: "no_screen" | "no_start_screen" | "unknown_block" | "not_a_page_block" | "unknown_variant" | "no_renderer"; message: string };

/**
 * Stock screens an empty page starts on (ADR 0024, empty start), in preference order: the first whose spec family
 * has the dropped block's kind becomes the page's screen (its family decides what else can be added, and the
 * catalog provenance gate keeps checking it). Marketing landing first: hero, features (stats, testimonials, FAQ,
 * logos ...), CTA, header and footer; then food (menu), restaurant (dish) and the dashboard console.
 */
export const EMPTY_PAGE_SCREENS = FAMILY_HOME_SCREENS;

/** The Stock screen an empty page starts on for a first section of `kind` (null kind: the default). */
export function emptyPageScreenFor(kind: PageBlockKind | null): CatalogScreen | null {
	for (const id of EMPTY_PAGE_SCREENS) {
		const screen = getScreenById(id);
		if (screen && (!kind || familyLabelForKind(screen, kind))) return screen;
	}
	return null;
}

/** Whether a page counts as not started: none at all, or no sections and no recorded Stock screen. */
function notStarted(ctx: { page: Page | null; provenance?: InspectorOpContext["provenance"] | null }): boolean {
	return !ctx.page || (ctx.page.layout.blocks.length === 0 && !ctx.provenance?.screenId);
}

export function canAddCatalogBlock(ctx: Pick<InspectorOpContext, "page" | "provenance"> | { page: null; provenance: null }, catalogBlock: string, variant?: string | null): AddBlockCheck {
	const entry = catalogEntryBySpec(catalogBlock);
	if (!entry?.available) return { ok: false, code: "unknown_block", message: `${catalogBlock} is not a Stock catalog block.` };
	const kind = entry.rendererCompatible && entry.rendererKind ? (entry.rendererKind as PageBlockKind) : null;
	if (!kind || CHILD_ONLY_KINDS.has(kind)) return { ok: false, code: "not_a_page_block", message: `${catalogBlock} has no page section renderer in this BuildY version yet.` };
	const want = variant ?? catalogSourceFor(catalogBlock)?.defaultVariant ?? null;
	if (want && !entry.variants.includes(want)) return { ok: false, code: "unknown_variant", message: `${catalogBlock} has no variant ${want}.` };
	// No page yet (or an empty one without a screen): the first section starts an empty page on a default Stock screen.
	const starting = notStarted(ctx);
	const screen = starting ? emptyPageScreenFor(kind) : ctx.provenance?.screenId ? getScreenById(ctx.provenance.screenId) : null;
	if (!screen) {
		return starting
			? { ok: false, code: "no_start_screen", message: `No Stock screen family has a ${kind} section to start a page with.` }
			: { ok: false, code: "no_screen", message: "The page has no recorded Stock screen, so blocks cannot be added." };
	}
	// ADR 0027: the screen family is advisory; a section of another family takes its Stock sample from that family.
	if (!kindSourceFor(screen, kind)) return { ok: false, code: "not_a_page_block", message: `No Stock screen has a ${kind} section.` };
	if (!registryItemFor(catalogBlock, want)) return { ok: false, code: "no_renderer", message: `${catalogBlock} has no page renderer in this BuildY version yet.` };
	return { ok: true, kind, variant: want, ...(starting ? { startScreenId: screen.screenId } : {}) };
}

export type EmptyPageStart = { page: Page; provenance: { screenId: string; scenarioId: ScenarioId | null; missing: string[]; assembler: string } };

/**
 * An empty page (no sections, no header or footer) on the Stock screen `emptyPageScreenFor(kind)` picks: page-spec
 * allows an empty layout and the catalog provenance gate passes an empty page on any screen. The first section is
 * then an ordinary inspector add on it. Null when no start screen has the kind.
 */
export function emptyPageStart(input: { kind?: PageBlockKind | null; screenId?: string | null; title: string; locale?: string | null; now?: Date | string; id?: string }): EmptyPageStart | null {
	const screen = input.screenId ? getScreenById(input.screenId) : emptyPageScreenFor(input.kind ?? null);
	if (!screen) return null;
	const stamp = (input.now ? new Date(input.now) : new Date()).toISOString();
	const title = input.title.trim().slice(0, 160) || "New page";
	const page = parsePageSpec(
		{
			id: input.id ?? "page-draft",
			slug: "home",
			status: "draft",
			title,
			layout: { version: 1, blocks: [] },
			seo: { title: title.slice(0, 200), description: `${title} draft. Not published. Catalog blocks only.`.slice(0, 200) },
			locale: input.locale && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.locale) ? input.locale : "en",
			createdAt: stamp,
			updatedAt: stamp
		},
		{ draft: true }
	);
	const checked = validateCatalogProvenance({ page, screenId: screen.screenId });
	if (!checked.ok) return null;
	const scenarioId: ScenarioId = /dashboard/.test(screen.spec) ? "dashboard" : "landing";
	return { page, provenance: { screenId: screen.screenId, scenarioId, missing: [], assembler: "empty-page" } };
}

export { addSlotCheck, chromeEdge, moveSlotCheck, type AddSlotCheck } from "./page-slots.ts";

/** The Stock sample of a catalog block variant as a new section of this page (the page's Stock screen family). */
function addedBlock(ctx: InspectorOpContext, catalogBlock: string, variant: string | null): PageBlock | InspectorFailure {
	const check = canAddCatalogBlock(ctx, catalogBlock, variant);
	if (!check.ok) return fail(check.code, check.message, "");
	const pageScreen = getScreenById(ctx.provenance!.screenId!)!;
	// The sample comes from the page's screen family, else from the first family with this kind (ADR 0027).
	const source = familyLabelForKind(pageScreen, check.kind) ? null : kindSourceFor(pageScreen, check.kind);
	const screen = source ? (getScreenById(source.screenId) ?? pageScreen) : pageScreen;
	const scenarioId: ScenarioId | null = source ? null : isScenarioId(ctx.provenance?.scenarioId) ? ctx.provenance!.scenarioId : null;
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
	const result = runOp(ctx, op);
	if (!result.ok || result.page === ctx.page) return result;
	return { ...result, op: result.op ?? HISTORY_OP[op.op], ...(result.path ? {} : pathOf(op) ? { path: pathOf(op) } : {}) };
}

/** Session history op of each inspector operation (session 1.6.0). */
const HISTORY_OP: Record<InspectorOp["op"], SessionRevisionOp> = {
	set_variant: "set_variant",
	reset: "replace",
	move: "move",
	duplicate: "insert",
	remove: "remove",
	duplicate_row: "insert",
	remove_row: "remove",
	add: "add",
	list_row: "insert"
};

function pathOf(op: InspectorOp): string | undefined {
	if (op.op === "list_row") return op.row !== undefined ? `${op.pointer}/${op.row}` : op.pointer;
	return undefined;
}

function runOp(ctx: InspectorOpContext, op: InspectorOp): InspectorResult {
	const blocks = ctx.page.layout.blocks;
	if (op.op === "add") {
		// After the selected section (a row counts as its section), else at the end; then every gate, or nothing changes.
		const anchor = op.blockId ? blocks.findIndex((node) => node.id === op.blockId || walkIds([node]).has(op.blockId)) : -1;
		if (op.blockId && anchor < 0) return fail("block_not_found", `No section ${op.blockId} on this page.`, "");
		const made = addedBlock(ctx, op.catalogBlock, op.variant ?? null);
		if ("ok" in made) return made;
		if (op.at !== undefined) {
			const slot = addSlotCheck(blocks, made.kind, op.at);
			if (!slot.ok) return fail(slot.code, slot.message, "");
		}
		const node = withFreshIds(made, walkIds(blocks));
		let next = [...blocks];
		next.splice(op.at ?? (anchor < 0 ? blocks.length : anchor + 1), 0, node);
		if (node.kind === "sidenav" || node.kind === "bottomnav") next = arrangeShell(next, ctx.page.locale).blocks;
		return gated(ctx, next, [node.id], node.id);
	}
	const index = blocks.findIndex((node) => node.id === op.blockId);
	const block = blocks[index];
	if (!block) return fail("block_not_found", `No section ${op.blockId} on this page.`, "");
	switch (op.op) {
		case "set_variant": {
			if (op.variant === block.variant) return { ok: true, page: ctx.page, blockId: block.id };
			const result = viaPatch(ctx, { op: "set_variant", blockId: block.id, variant: op.variant }, block.id);
			if (!result.ok || !block.props) return result;
			// The patch dropped axis overrides (the variant sets them) and pointers the variant has not: name them.
			const kept = new Set(Object.keys(result.page.layout.blocks.find((node) => node.id === block.id)?.props ?? {}));
			const dropped = Object.keys(block.props).filter((pointer) => !kept.has(pointer));
			return dropped.length ? { ...result, dropped } : result;
		}
		case "move":
			if (op.to < 0 || op.to >= blocks.length) return fail("index_out_of_range", `A section moves to 1..${blocks.length}.`, "");
			if (op.to === index) return { ok: true, page: ctx.page, blockId: block.id };
			{
				const slot = moveSlotCheck(blocks, index, op.to);
				if (!slot.ok) return fail(slot.code, slot.message, "");
			}
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
			const list = pageListName(organismFor(block)?.item ?? "");
			const nextRows = [...rows];
			if (op.op === "remove_row") nextRows.splice(op.row, 1);
			else {
				const max = PAGE_SLOTS[block.kind]?.items?.max ?? 0;
				if (rows.length >= max) return fail("rows_over_limit", `${block.kind} renders at most ${max} rows.`, "");
				nextRows.splice(op.row + 1, 0, cloneWithIds(row, walkIds(blocks)));
			}
			let nextBlock: PageBlock = { ...block, children: nextRows };
			if (!nextRows.length) delete nextBlock.children;
			if (list) {
				nextBlock = op.op === "remove_row"
					? remapRowOverrides(nextBlock, list, (i) => (i === op.row ? null : i > op.row ? i - 1 : i))
					: remapRowOverrides(nextBlock, list, (i) => (i > op.row ? i + 1 : i));
			}
			const next = [...blocks];
			next[index] = nextBlock;
			const result = gated(ctx, next, [block.id], block.id);
			return result.ok && list ? { ...result, path: `/${list}/${op.row}` } : result;
		}
		case "list_row":
			return listRow(ctx, index, block, op);
	}
}

/** Add, remove or move a row of a list prop: the block's page rows, or a props override list written whole. */
function listRow(ctx: InspectorOpContext, index: number, block: PageBlock, op: Extract<InspectorOp, { op: "list_row" }>): InspectorResult {
	const render = organismFor(block);
	if (!render) return fail("not_in_registry", `Section ${block.id} has no registry block.`, op.pointer);
	const node = propsNodeAt(render.item, op.pointer);
	if (!node || node.kind !== "list" || !node.fields) return fail("not_a_list", `${op.pointer} is not a list of rows of ${render.item}.`, op.pointer);
	const blocks = ctx.page.layout.blocks;
	const row = op.row ?? -1;
	const moveTo = op.action === "up" ? row - 1 : op.action === "down" ? row + 1 : row;
	if (pageRowList(block, render, op.pointer)) {
		const rows = block.children ?? [];
		const list = op.pointer.slice(1);
		if (op.action === "add") {
			const max = PAGE_SLOTS[block.kind]?.items?.max ?? 0;
			if (rows.length >= max) return fail("rows_over_limit", `${block.kind} renders at most ${max} rows.`, op.pointer);
			const kind = PAGE_SLOTS[block.kind]!.items!.kind as PageBlockKind;
			const template: PageBlock = rows.at(-1) ? cloneWithIds(rows.at(-1)!, walkIds(blocks)) : { id: freeId(`${block.id}-row`, walkIds(blocks)), kind, title: "New item", summary: "Describe this item." };
			const nextBlock: PageBlock = { ...block, children: [...rows, { ...template, title: "New item" }] };
			const next = [...blocks];
			next[index] = nextBlock;
			const result = gated(ctx, next, [block.id], block.id);
			return result.ok ? { ...result, op: "insert", path: `${op.pointer}/${rows.length}` } : result;
		}
		if (!rows[row]) return fail("row_not_found", `Section ${block.id} has no row ${row + 1}.`, op.pointer);
		if (op.action === "remove") return runOp(ctx, { op: "remove_row", blockId: block.id, row });
		if (moveTo < 0 || moveTo >= rows.length) return fail("index_out_of_range", `Row ${row + 1} cannot move ${op.action}.`, op.pointer);
		const nextRows = [...rows];
		[nextRows[row], nextRows[moveTo]] = [nextRows[moveTo]!, nextRows[row]!];
		const nextBlock = remapRowOverrides({ ...block, children: nextRows }, list, (i) => (i === row ? moveTo : i === moveTo ? row : i));
		const next = [...blocks];
		next[index] = nextBlock;
		const result = gated(ctx, next, [block.id], block.id);
		return result.ok ? { ...result, op: "move", path: `${op.pointer}/${row}` } : result;
	}
	// A props list: the rendered rows (variant sample or override) become the override, then the change.
	const current = valueAtPointer(render.props, op.pointer);
	const rows = Array.isArray(current) ? [...(current as PagePropValue[])] : [];
	let opName: SessionRevisionOp = "insert";
	if (op.action === "add") {
		const max = Math.min(node.maxItems ?? PAGE_PROPS_LIMITS.maxListItems, PAGE_PROPS_LIMITS.maxListItems);
		if (rows.length >= max) return fail("rows_over_limit", `${op.pointer} holds at most ${max} rows.`, op.pointer);
		const fresh = newPropsListRow(render.item, op.pointer, rows);
		if (!fresh) return fail("not_a_list", `${op.pointer} has no row schema.`, op.pointer);
		rows.push(fresh as PagePropValue);
	} else {
		if (!rows[row]) return fail("row_not_found", `${op.pointer} has no row ${row + 1}.`, op.pointer);
		if (op.action === "remove") {
			rows.splice(row, 1);
			opName = "remove";
		} else {
			if (moveTo < 0 || moveTo >= rows.length) return fail("index_out_of_range", `Row ${row + 1} cannot move ${op.action}.`, op.pointer);
			[rows[row], rows[moveTo]] = [rows[moveTo]!, rows[row]!];
			opName = "move";
		}
	}
	const next = [...blocks];
	next[index] = withPropsOverride(block, op.pointer, rows);
	const result = gated(ctx, next, [block.id], block.id);
	return result.ok ? { ...result, op: opName, path: op.action === "add" ? `${op.pointer}/${rows.length - 1}` : `${op.pointer}/${row}` } : result;
}

export type ScreenAddResult =
	| (InspectorSuccess & { added: string[]; skipped: string[] })
	| { ok: false; code: string; message: string; skipped: string[] };

/**
 * Drop a Stock screen into a page (t150u): the screen's renderable sections (screenSections) as inspector adds at
 * slot `at` (default: the end), every gate per section, one result for one undo step. Hard rules only: a header
 * goes to the top and a footer to the end, and one the page already has (same kind) is skipped; a section a gate
 * refuses is skipped with its catalog block, never invented. The screen family stays advisory (ADR 0027).
 */
export function addScreenSections(ctx: InspectorOpContext, screenId: string, at?: number): ScreenAddResult {
	if (!getScreenById(screenId)) return { ok: false, code: "unknown_screen", message: `${screenId} is not a Stock screen.`, skipped: [] };
	const { sections, missing } = screenSections(screenId);
	const skipped = [...missing];
	if (!sections.length) return { ok: false, code: "no_sections", message: `${screenId} has no section this BuildY version renders.`, skipped };
	let page = ctx.page;
	let slot = Math.max(0, Math.min(at ?? page.layout.blocks.length, page.layout.blocks.length));
	let last: InspectorSuccess | null = null;
	const added: string[] = [];
 let firstFailure: InspectorFailure | null = null;
	for (const section of sections) {
		const blocks = page.layout.blocks;
		const edge = chromeEdge(section.kind);
		if (edge && blocks.some((node) => node.kind === section.kind)) {
			skipped.push(section.catalogBlock);
			continue;
		}
		const target = edge === "top" ? 0 : edge === "bottom" ? blocks.length : slot;
		if (!addSlotCheck(blocks, section.kind, target).ok) {
			skipped.push(section.catalogBlock);
			continue;
		}
		const result = inspectorOp({ ...ctx, page }, { op: "add", blockId: "", catalogBlock: section.catalogBlock, variant: section.variant, at: target });
		if (!result.ok) {
   firstFailure ??= result;
			skipped.push(section.catalogBlock);
			continue;
		}
		page = result.page;
		last = result;
		added.push(result.blockId);
		// Content keeps screen order after the slot; a header inserted above shifts the slot down by one.
		if (edge === "top") slot += 1;
		else if (!edge) slot = target + 1;
	}
	if (!last && firstFailure) return {ok:false,code:firstFailure.code,message:firstFailure.message,skipped};
 if (!last) return { ok: false, code: "nothing_added", message: `No section of ${screenId} fits this page.`, skipped };
	return { ...last, blockId: added[0]!, op: "add", added, skipped };
}

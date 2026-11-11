/**
 * Page block -> registry block and its props. One mapping for the chat preview and the exported project. Every input
 * is generated data (scripts/registry-snapshot.mjs): the catalog asset -> registry item link and the variant props
 * come from the published registry.buildy.tw/variants/v0.json, the prop names, their kinds and the defaults of
 * required props from the published props schema (registry.buildy.tw/props/v0.json). Pure data, no Svelte; safe to
 * import in the browser bundle.
 *
 * props = fill(merge(variant props, content of the page block)): the schema fills every required prop the variant and
 * the content leave out. Dictionary refs (`{"$": "ui.*"}`) of the published variant props are dropped (the en
 * dictionary is not published), so the page content fills those slots; the page content wins over sample literals of
 * a variant (an action href), the variant sets the layout axes. The props gate (props-gate.ts) validates the result.
 */
import raw from "./sources.json" with { type: "json" };
import { PAGE_SLOTS, type PageBlock, type PageBlockKind } from "@buildytech/page-contract";
import type { CatalogSources } from "./sources.ts";
import { fillProps, propShapeFor, propsEventsFor, type PropShape } from "./props-schema.ts";

const sources = raw as unknown as CatalogSources;

export type OrganismRender = {
	catalogBlock: string;
	/** Registry item name (`npx ui8kit add <item>`). */
	item: string;
	/** Block file inside the registry tree, e.g. blocks/feature-grid.svelte. */
	organism: string;
	variant: string;
	props: Record<string, unknown>;
	/** JSON Pointer of a prop -> the page-block field it came from (`copy.headline`, `children[2].copy.icon`). */
	origins: Record<string, string>;
	/** Callbacks (`onadd`) and snippets (`footer`) of the block: wired by the host, never page data. */
	events: string[];
	slots: string[];
};

type Json = unknown;

function isObject(value: Json): value is Record<string, Json> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A dictionary / data ref (`{"$": ...}`) or a data op (`{op, args}`): the Svelte block cannot resolve either. */
function isRef(value: Json): boolean {
	return isObject(value) && ("$" in value || ("op" in value && "args" in value));
}

/** Published variant props without dictionary / collection refs and data ops (the schema fills what they leave). */
function withoutRefs(value: Json): Json {
	if (Array.isArray(value)) return value.map(withoutRefs);
	if (!isObject(value)) return value;
	const out: Record<string, Json> = {};
	for (const [key, inner] of Object.entries(value)) {
		if (isRef(inner)) continue;
		out[key] = withoutRefs(inner);
	}
	return out;
}

function merge(base: Json, over: Json): Json {
	if (!isObject(base) || !isObject(over)) return over === undefined ? base : over;
	const out: Record<string, Json> = { ...base };
	for (const [key, value] of Object.entries(over)) out[key] = merge(base[key], value);
	return out;
}

/** Page copy keys (page-spec) -> registry prop names that carry the same text. */
const COPY_FIELDS: Record<string, keyof NonNullable<PageBlock["copy"]>> = {
	eyebrow: "eyebrow",
	kicker: "eyebrow",
	overline: "eyebrow",
	badge: "badge",
	brand: "brand",
	note: "note",
	legal: "legal",
	copyright: "legal",
	contact: "contact",
	address: "address",
	days: "days",
	value: "value"
};
const LABEL_FIELDS = new Set(["label", "name", "text", "title"]);
const TITLE = new Set(["title", "heading", "name", "label", "question", "author", "brand"]);
const TEXT = new Set(["text", "lead", "summary", "description", "subtitle", "intro", "excerpt", "body", "answer", "quote", "note", "hint", "tagline"]);
const ACTION_LABEL = new Set(["label", "cta", "text"]);

type Origins = Record<string, string>;

function record(child: PageBlock, at: string, list: PropShape["lists"][string], origins: Origins, base: string): Record<string, Json> {
	const row: Record<string, Json> = {};
	const title = child.copy?.headline ?? child.title;
	const text = child.copy?.lede ?? child.summary;
	const set = (field: string, value: Json, from: string) => {
		row[field] = value;
		origins[`${base}/${field}`] = `${at}.${from}`;
	};
	for (const [field, kind] of Object.entries(list.record)) {
		if (field === "icon" && kind === "icon") {
			// Kept as written; the props gate checks it against the contract's Lucide enum.
			if (child.copy?.icon !== undefined) set("icon", child.copy.icon, "copy.icon");
			continue;
		}
		if (kind !== "text") continue;
		if (field === "id") set("id", child.id, "id");
		else if (TITLE.has(field) && title) set(field, title, child.copy?.headline ? "copy.headline" : "title");
		else if (TEXT.has(field) && text) set(field, text, child.copy?.lede ? "copy.lede" : "summary");
		else if (field === "href" && child.copy?.href) set("href", child.copy.href, "copy.href");
		else if (COPY_FIELDS[field] && child.copy?.[COPY_FIELDS[field]!]) set(field, child.copy[COPY_FIELDS[field]!]!, `copy.${COPY_FIELDS[field]}`);
	}
	return row;
}

/** Page content in the block's own prop names (text goes only to text props of the schema, never to an enum axis). */
function content(block: PageBlock, shape: PropShape, origins: Origins): Record<string, Json> {
	const out: Record<string, Json> = {};
	const set = (prop: string, value: Json, from: string) => {
		out[prop] = value;
		origins[`/${prop}`] = from;
	};
	const text = new Set(shape.text);
	if (text.has("id")) set("id", block.id, "id");
	// Edits land in copy (edit_page `set` headline / lede); copy wins over the block's title / summary.
	const heading = block.copy?.headline ?? block.title;
	const lede = block.copy?.lede ?? block.summary;
	const title = shape.text.find((prop) => TITLE.has(prop) && prop !== "brand");
	if (title && heading) set(title, heading, block.copy?.headline ? "copy.headline" : "title");
	const lead = shape.text.find((prop) => TEXT.has(prop));
	if (lead && lede) set(lead, lede, block.copy?.lede ? "copy.lede" : "summary");
	for (const prop of shape.props) {
		const key = COPY_FIELDS[prop];
		const value = key ? block.copy?.[key] : undefined;
		if (!value || prop in out) continue;
		if (text.has(prop)) set(prop, value, `copy.${key}`);
		else if (shape.objects[prop]) {
			const field = Object.entries(shape.objects[prop]!).find(([name, kind]) => LABEL_FIELDS.has(name) && kind === "text")?.[0];
			if (field) {
				out[prop] = { [field]: value };
				origins[`/${prop}/${field}`] = `copy.${key}`;
			}
		}
	}
	// Chrome labels (site-header / app bars): `labels.brand` carries the page brand.
	if (block.copy?.brand && shape.objects.labels?.brand === "text") {
		out.labels = { brand: block.copy.brand };
		origins["/labels/brand"] = "copy.brand";
	}
	const children = block.children ?? [];
	const lists = Object.entries(shape.lists).sort(([, a], [, b]) => Number(b.required) - Number(a.required));
	// No rows: the block's empty state (`empty`, or `labels.empty`) says so in the page's words (its lede / summary).
	if (!children.length && lists.length && lede) {
		if (text.has("empty") && !("empty" in out)) set("empty", lede, block.copy?.lede ? "copy.lede" : "summary");
		else if (shape.objects.labels?.empty === "text") {
			out.labels = { ...(out.labels as Record<string, Json> | undefined), empty: lede };
			origins["/labels/empty"] = block.copy?.lede ? "copy.lede" : "summary";
		}
	}
	if (children.length && lists.length) {
		const [name, list] = lists[0]!;
		out[name] = children.map((child, index) => {
			origins[`/${name}/${index}`] = `children[${index}]`;
			return record(child, `children[${index}]`, list, origins, `/${name}/${index}`);
		});
	}
	const action = block.copy?.action;
	if (action) {
		for (const name of ["action", "actions", "cta"]) {
			const fields = shape.objects[name];
			if (!fields) continue;
			const label = Object.keys(fields).find((field) => ACTION_LABEL.has(field) && fields[field] === "text");
			if (!label) continue;
			out[name] = { [label]: action, ...(fields.href ? { href: block.copy?.href || "#" } : {}) };
			origins[`/${name}/${label}`] = "copy.action";
			if (fields.href) origins[`/${name}/href`] = "copy.href";
			break;
		}
	}
	return out;
}

/** The registry item and variant of a catalog block (`block.features` + `grid`), or null when the registry has none. */
export function registryItemFor(catalogBlock: string | undefined | null, variant?: string | null): { item: string; variant: string } | null {
	if (!catalogBlock) return null;
	if (variant) {
		const hit = sources.assets[`${catalogBlock}/${variant}`];
		if (hit) return hit;
	}
	return sources.specs[catalogBlock] ?? null;
}

/** The registry block and its props for a page block, or null when the block has no registry item (stub). */
export function organismFor(block: PageBlock): OrganismRender | null {
	const hit = registryItemFor(block.catalogBlock, block.variant);
	if (!hit || !block.catalogBlock) return null;
	const source = sources.blocks[hit.item]!;
	const shape = propShapeFor(hit.item);
	if (!shape) return null;
	const origins: Origins = {};
	const merged = merge(withoutRefs(source.variants[hit.variant]), content(block, shape, origins)) as Record<string, unknown>;
	const props = fillProps(hit.item, merged);
	const { events, slots } = propsEventsFor(hit.item);
	return { catalogBlock: block.catalogBlock, item: hit.item, organism: source.organism, variant: hit.variant, props, origins, events, slots };
}

/** Page-spec fields a prop can be written back to: a block or row title / summary or a copy key. */
const WRITABLE_ORIGIN = /^(?:children\[\d+\]\.)*(?:title|summary|copy\.[a-z]+)$/;

function slotCopy(kind: PageBlockKind): readonly string[] {
	return (PAGE_SLOTS[kind]?.copy ?? []) as readonly string[];
}

/** Where the lede of a block (or row) lives: `copy.lede` when its kind renders that copy key, else its summary. */
function ledeOrigin(kind: PageBlockKind): string {
	return slotCopy(kind).includes("lede") ? "copy.lede" : "summary";
}

/** The action object of a shape (`action`, `actions` or `cta`) and its label field, in the order content() reads them. */
function actionFields(shape: PropShape): { name: string; label: string; href: boolean } | null {
	for (const name of ["action", "actions", "cta"]) {
		const fields = shape.objects[name];
		if (!fields) continue;
		const label = Object.keys(fields).find((field) => ACTION_LABEL.has(field) && fields[field] === "text");
		if (label) return { name, label, href: fields.href === "text" };
	}
	return null;
}

/** The page-spec field an empty top-level text prop would be read from (the same rules as content()). */
function emptyTopLevel(block: PageBlock, shape: PropShape, name: string): string | null {
	if (!shape.text.includes(name)) return null;
	const title = shape.text.find((prop) => TITLE.has(prop) && prop !== "brand");
	if (name === title) return slotCopy(block.kind).includes("headline") ? "copy.headline" : "title";
	const lead = shape.text.find((prop) => TEXT.has(prop));
	if (name === lead) return ledeOrigin(block.kind);
	// The empty state reads the lede while the block has no rows.
	if (name === "empty" && !(block.children ?? []).length && Object.keys(shape.lists).length) return ledeOrigin(block.kind);
	const key = COPY_FIELDS[name];
	if (key && slotCopy(block.kind).includes(key)) return `copy.${key}`;
	return null;
}

/** The page-spec field an empty text field of an object prop (`/action/label`, `/labels/brand`) would be read from. */
function emptyInObject(block: PageBlock, shape: PropShape, object: string, field: string): string | null {
	const fields = shape.objects[object];
	if (fields?.[field] !== "text") return null;
	const slot = slotCopy(block.kind);
	const action = actionFields(shape);
	if (action && action.name === object && slot.includes("action")) {
		if (field === action.label) return "copy.action";
		if (field === "href" && action.href) return "copy.href";
	}
	if (object === "labels" && field === "brand" && slot.includes("brand")) return "copy.brand";
	if (object === "labels" && field === "empty" && !shape.text.includes("empty") && !(block.children ?? []).length && Object.keys(shape.lists).length) {
		return ledeOrigin(block.kind);
	}
	const key = COPY_FIELDS[object];
	if (key && !shape.text.includes(object) && slot.includes(key)) {
		const label = Object.entries(fields).find(([name, kind]) => LABEL_FIELDS.has(name) && kind === "text")?.[0];
		if (label === field) return `copy.${key}`;
	}
	return null;
}

/** The row field (`children[i]...`) an empty field of a page row would be read from (the same rules as record()). */
function emptyInRow(child: PageBlock, kind: string | undefined, field: string): string | null {
	const slot = slotCopy(child.kind);
	if (field === "icon" && kind === "icon") return slot.includes("icon") ? "copy.icon" : null;
	if (kind !== "text" || field === "id") return null;
	if (TITLE.has(field)) return slot.includes("headline") ? "copy.headline" : "title";
	if (TEXT.has(field)) return ledeOrigin(child.kind);
	if (field === "href") return slot.includes("href") ? "copy.href" : null;
	const key = COPY_FIELDS[field];
	return key && slot.includes(key) ? `copy.${key}` : null;
}

/**
 * The page-spec field a prop of the block's render is written back to (the inverse of the mapping above), or null
 * when the prop is not page content (a variant axis, a schema default, an id). A prop that has content today keeps
 * its origin; an empty one is writable when the mapping above would read it once set: the title / lead / empty
 * state of the block, a copy key the block kind renders (`eyebrow`, `badge`, ...), the label and link of its action,
 * and the title / text / icon / link of a page row whose kind renders that field.
 */
export function writableOrigin(block: PageBlock, render: Pick<OrganismRender, "item" | "origins">, pointer: string): string | null {
	const known = render.origins[pointer];
	if (known) return WRITABLE_ORIGIN.test(known) ? known : null;
	const shape = propShapeFor(render.item);
	if (!shape) return null;
	const parts = pointer.split("/").slice(1);
	if (parts.length === 1) return emptyTopLevel(block, shape, parts[0]!);
	if (parts.length === 2) return emptyInObject(block, shape, parts[0]!, parts[1]!);
	if (parts.length === 3 && /^\d+$/.test(parts[1]!)) {
		const row = render.origins[`/${parts[0]}/${parts[1]}`];
		const index = row ? /^children\[(\d+)\]$/.exec(row)?.[1] : undefined;
		const child = index !== undefined ? block.children?.[Number(index)] : undefined;
		if (!child) return null;
		const field = emptyInRow(child, shape.lists[parts[0]!]?.record[parts[2]!], parts[2]!);
		return field ? `${row}.${field}` : null;
	}
	return null;
}

/** The published props of a variant without dictionary refs: what the variant itself sets (axes, sample literals). */
export function variantPreset(item: string, variant: string): Record<string, unknown> {
	const value = sources.blocks[item]?.variants[variant];
	return isObject(value) ? (withoutRefs(value) as Record<string, unknown>) : {};
}

/** Named variants of a registry item with their published props (the presets the Variant select offers). */
export function variantPresets(item: string): Record<string, Record<string, unknown>> {
	const out: Record<string, Record<string, unknown>> = {};
	for (const name of Object.keys(sources.blocks[item]?.variants ?? {})) out[name] = variantPreset(item, name);
	return out;
}

/** npm packages the registry tree imports (clsx, tailwind-merge; svelte is the framework). */
export const registryNpmDependencies: readonly string[] = sources.npmDependencies;

/** Items `npx ui8kit init` installs before any `add`. */
export const registryInitItems: readonly string[] = sources.initItems;

/**
 * Registry file paths (relative to the CLI install root, e.g. `src/blocks/feature-grid.svelte`) of `init` plus
 * `add <items>`: the items and their registryDependencies, transitively. Unknown names throw.
 */
export function registryClosure(items: readonly string[]): string[] {
	const seen = new Set<string>();
	const files = new Set<string>();
	const queue = [...sources.initItems, ...items];
	while (queue.length) {
		const name = queue.shift()!;
		if (seen.has(name)) continue;
		const item = sources.items[name];
		if (!item) throw new Error(`registry item ${name} is not in the pinned snapshot`);
		seen.add(name);
		for (const file of item.files) files.add(file);
		queue.push(...item.registryDependencies);
	}
	return [...files].sort();
}

export type RegistrySkin = { id: string; item: string; title: string; file: string };

/** Skins of the pinned registry (`npx ui8kit add theme-<id>`), sorted by title. */
export function registrySkins(): RegistrySkin[] {
	return Object.entries(sources.themes?.skins ?? {})
		.map(([id, skin]) => ({ id, ...skin }))
		.sort((a, b) => a.title.localeCompare(b.title));
}

/** The skin with this id, or null when the pinned registry has none (unknown ids fall back to the default theme). */
export function registrySkin(id: string | null | undefined): RegistrySkin | null {
	if (!id) return null;
	const skin = sources.themes?.skins?.[id];
	return skin ? { id, ...skin } : null;
}

/** CSS files of theme-base (what every skin depends on), as `npx ui8kit add theme-<id>` writes them. */
export function registrySkinBaseCss(): string[] {
	return (sources.themes?.base?.files ?? []).filter((file) => file.endsWith(".css"));
}

/** Registry item that installs a skin. */
export const skinItem = (id: string): string => `theme-${id}`;

/** Files `npx ui8kit add <name>` writes for one item (pinned snapshot, paths under the install root). */
export function registryItemFiles(name: string): string[] {
	const item = sources.items[name];
	if (!item) throw new Error(`registry item ${name} is not in the pinned snapshot`);
	return [...item.files];
}

/** Item names of `init` plus `add <items>` with registryDependencies, transitively (lock entries of the CLI). */
export function registryItemClosure(items: readonly string[]): string[] {
	const seen = new Set<string>();
	const queue = [...sources.initItems, ...items];
	while (queue.length) {
		const name = queue.shift()!;
		if (seen.has(name)) continue;
		const item = sources.items[name];
		if (!item) throw new Error(`registry item ${name} is not in the pinned snapshot`);
		seen.add(name);
		queue.push(...item.registryDependencies);
	}
	return [...seen].sort();
}

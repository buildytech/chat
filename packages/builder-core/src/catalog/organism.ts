/**
 * Page block -> registry block and its props. One mapping for the chat preview and the exported project. Every input
 * is generated data (sources.json, scripts/registry-snapshot.mjs): the catalog asset -> registry item link and the
 * variant props come from the published registry.buildy.tw/variants/v0.json, the prop names and required-prop
 * defaults from the block's own `XxxProps` type. Pure data, no Svelte; safe to import in the browser bundle.
 *
 * props = merge(defaults, variant props, content of the page block). Dictionary refs (`{"$": "ui.*"}`) of the
 * published variant props are dropped (the en dictionary is not published), so the page content fills those slots;
 * the page content wins over sample literals of a variant (an action href), the variant sets the layout axes.
 */
import raw from "./sources.json" with { type: "json" };
import type { PageBlock } from "@buildytech/page-contract";
import type { CatalogSources, RegistryBlock } from "./sources.ts";

const sources = raw as unknown as CatalogSources;
const icons = new Set(sources.icons);

export type OrganismRender = {
	catalogBlock: string;
	/** Registry item name (`npx ui8kit add <item>`). */
	item: string;
	/** Block file inside the registry tree, e.g. blocks/feature-grid.svelte. */
	organism: string;
	variant: string;
	props: Record<string, unknown>;
};

type Json = unknown;

function isObject(value: Json): value is Record<string, Json> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Published variant props without dictionary / collection refs. */
function withoutRefs(value: Json): Json {
	if (Array.isArray(value)) return value.map(withoutRefs);
	if (!isObject(value)) return value;
	const out: Record<string, Json> = {};
	for (const [key, inner] of Object.entries(value)) {
		if (isObject(inner) && "$" in inner) continue;
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

const TITLE = new Set(["title", "heading", "name", "label", "question", "author", "brand"]);
const TEXT = new Set(["text", "lead", "summary", "description", "subtitle", "intro", "excerpt", "body", "answer", "quote", "note", "hint", "tagline"]);
const ACTION_LABEL = new Set(["label", "cta", "text"]);

function iconOf(value: unknown, fallback: unknown): string {
	if (typeof value === "string" && icons.has(value)) return value;
	return typeof fallback === "string" && icons.has(fallback) ? fallback : "circle-dot";
}

function record(child: PageBlock, list: RegistryBlock["lists"][string]): Record<string, Json> {
	const row: Record<string, Json> = { ...list.defaults };
	for (const [field, type] of Object.entries(list.record)) {
		if (type !== "string") continue;
		if (field === "id") row.id = child.id;
		else if (field === "icon") row.icon = iconOf(child.copy?.icon, list.defaults.icon);
		else if (TITLE.has(field) && child.title) row[field] = child.title;
		else if (TEXT.has(field) && child.summary) row[field] = child.summary;
		else if (field === "href" && child.copy?.href) row.href = child.copy.href;
	}
	return row;
}

/** Page content in the block's own prop names. */
function content(block: PageBlock, source: RegistryBlock): Record<string, Json> {
	const out: Record<string, Json> = {};
	const has = new Set(source.props);
	if (has.has("id")) out.id = block.id;
	const title = source.props.find((prop) => TITLE.has(prop) && !source.lists[prop] && !source.objects[prop]);
	if (title && block.title) out[title] = block.title;
	const text = source.props.find((prop) => TEXT.has(prop) && !source.lists[prop] && !source.objects[prop]);
	if (text && block.summary) out[text] = block.summary;
	const children = block.children ?? [];
	const lists = Object.entries(source.lists).sort(([, a], [, b]) => Number(b.required) - Number(a.required));
	if (children.length && lists.length) {
		const [name, list] = lists[0]!;
		out[name] = children.map((child) => record(child, list));
	}
	const action = block.copy?.action;
	if (action) {
		for (const name of ["action", "actions", "cta"]) {
			const fields = source.objects[name];
			if (!fields) continue;
			const label = fields.find((field) => ACTION_LABEL.has(field));
			if (!label) continue;
			out[name] = { [label]: action, ...(fields.includes("href") ? { href: block.copy?.href || "#" } : {}) };
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
	const props = merge(merge(source.defaults, withoutRefs(source.variants[hit.variant])), content(block, source)) as Record<string, unknown>;
	return { catalogBlock: block.catalogBlock, item: hit.item, organism: source.organism, variant: hit.variant, props };
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

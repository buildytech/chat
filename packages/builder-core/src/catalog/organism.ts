/**
 * Registry item lookups over the generated catalog sources (scripts/registry-snapshot.mjs): the catalog asset -> registry
 * item link, the published props of each variant (presets) and the registry files an item needs. Pure data, no Svelte;
 * safe to import in the browser bundle. The props of a page-spec/v2 block are the block's own (page-doc/render.ts); the
 * page-spec/v1 mapper of page content to props is gone (ADR 0045).
 */
import raw from "./sources.json" with { type: "json" };
import type { CatalogSources } from "./sources.ts";

const sources = raw as unknown as CatalogSources;

/** What the props gate checks: a registry item and its render props. */
export type RegistryRender = { item: string; props: Record<string, unknown> };

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

/** The registry item and variant of a catalog block (`block.features` + `grid`), or null when the registry has none. */
export function registryItemFor(catalogBlock: string | undefined | null, variant?: string | null): { item: string; variant: string } | null {
	if (!catalogBlock) return null;
	if (variant) {
		const hit = sources.assets[`${catalogBlock}/${variant}`];
		if (hit) return hit;
	}
	return sources.specs[catalogBlock] ?? null;
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

/** Top-level props the named variants of an item set (its layout axes): a variant switch resets their overrides. */
export function variantAxisProps(item: string): Set<string> {
	const out = new Set<string>();
	for (const preset of Object.values(variantPresets(item))) for (const key of Object.keys(preset)) out.add(key);
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

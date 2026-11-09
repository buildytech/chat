/**
 * Page block -> registry organism props. One mapping for the chat preview and the exported Svelte project:
 * the slot paths come from registry/registry.config.json (via sources.json), the variant props from the compose-gen
 * block spec presets. Pure data, no Svelte; safe to import in the browser bundle.
 */
import raw from "./sources.json" with { type: "json" };
import type { PageBlock } from "@buildytech/page-contract";
import type { CatalogSourceBlock, CatalogSources } from "./sources.ts";

const sources = raw as unknown as CatalogSources;
const icons = new Set(sources.icons);

export type OrganismRender = {
	catalogBlock: string;
	/** Registry item name (`npx ui8kit add <item>`). */
	item: string;
	/** Organism file inside the vendored registry tree, e.g. blocks/feature-grid.svelte. */
	organism: string;
	variant: string;
	props: Record<string, unknown>;
};

type Scope = { block: PageBlock; child?: PageBlock };

function read(path: string, scope: Scope): unknown {
	const [root, ...rest] = path.split(".");
	let value: unknown = root === "block" ? scope.block : root === "child" ? scope.child : root === "copy" ? scope.block.copy : undefined;
	for (const key of rest) value = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
	return value;
}

function mapProps(mapping: CatalogSourceBlock["props"], source: CatalogSourceBlock, scope: Scope): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [prop, spec] of Object.entries(mapping)) {
		if (typeof spec === "string") {
			const value = read(spec, scope);
			if (value !== undefined && value !== null && value !== "") out[prop] = value;
		} else if ("from" in spec && spec.from === "children") {
			const fields = (spec as { fields: Record<string, string> }).fields;
			out[prop] = (scope.block.children ?? []).map((child) => {
				const row: Record<string, unknown> = {};
				for (const [field, path] of Object.entries(fields)) {
					const value = read(path, { block: scope.block, child });
					if (field === "icon") row[field] = icons.has(String(value)) ? value : source.fallbackIcon;
					else row[field] = value ?? "";
				}
				return row;
			});
		} else {
			// A nested prop (action {label, href}) is passed only when every field has a value.
			const nested = mapProps(spec as Record<string, string>, source, scope);
			if (Object.keys(nested).length === Object.keys(spec).length) out[prop] = nested;
		}
	}
	return out;
}

/** The registry organism and its props for a page block, or null when the block has no registry source. */
export function organismFor(block: PageBlock): OrganismRender | null {
	if (!block.catalogBlock) return null;
	const source = sources.blocks[block.catalogBlock];
	if (!source || source.kind !== block.kind) return null;
	const variant = block.variant && source.variants[block.variant] ? block.variant : source.defaultVariant;
	return {
		catalogBlock: block.catalogBlock,
		item: source.item,
		organism: source.organism,
		variant,
		props: { ...source.variants[variant].props, ...mapProps(source.props, source, { block }) }
	};
}

/** npm packages the vendored registry tree imports (svelte, clsx, tailwind-merge). */
export const registryNpmDependencies: readonly string[] = sources.npmDependencies;

/**
 * Vendored file paths of registry items and their registryDependencies, transitively (what `npx ui8kit add`
 * installs). Unknown names throw: the snapshot must contain every item a page uses.
 */
export function registryClosure(items: readonly string[]): string[] {
	const seen = new Set<string>();
	const files = new Set<string>();
	const queue = [...items];
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

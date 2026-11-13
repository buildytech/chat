/**
 * Page -> Svelte source of a Vite project laid out like `npx ui8kit init` + `npx ui8kit add <items>` (install root
 * `src`): the page is src/App.svelte composing one src/sections/<block-id>.svelte per page block, and every section is a
 * UI8Kit registry block (src/blocks/<item>.svelte) with its props (ADR 0034: the block's `props`, exactly). The registry files themselves come from the pinned snapshot (registry/svelte), never from here.
 */
import { itemInfo, registryClosure, registryItemClosure, registryItemFiles, registrySkin, renderBlock, skinItem, type BlockRender } from "@buildytech/builder-core";
import type { BlockV2, PageV2 } from "@buildytech/page-contract";

/** CLI install root of the exported project (ui8kit.config.json `dir`, the CLI default). */
export const INSTALL_ROOT = "src";
export const APP_FILE = `${INSTALL_ROOT}/App.svelte`;
export const SECTIONS_DIR = `${INSTALL_ROOT}/sections`;
export type SourceFile = { path: string; content: string };

function identFromBlockId(id: string): string {
	const cleaned = id.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
	const base = cleaned || "Block";
	const named = /^[A-Za-z]/.test(base) ? base : `Block_${base}`;
	return named[0]!.toUpperCase() + named.slice(1);
}

function organismIdent(organism: string): string {
	const base = organism.split("/").pop()!.replace(/\.svelte$/, "");
	return base.replace(/(^|-)([a-z0-9])/g, (_, __, ch: string) => ch.toUpperCase());
}

/** Copy never holds `<` (page contract); escape anyway so the JSON can never close the script element. */
function jsonProps(value: unknown): string {
	return JSON.stringify(value, null, "\t").replace(/</g, "\\u003c").split("\n").join("\n\t");
}

/**
 * Events and slots of the block come from its published props schema (`events`, `slots` next to `schema`): they are
 * not data, so the section wires each event to a handler stub the project fills in and names the slots it may pass.
 */
function sectionForRegistry(render: BlockRender): string {
	const ident = organismIdent(render.organism);
	const handlers = render.events.map((event) => `on${event}`);
	const wiring = handlers.length
		? `\n\n\t// Events of ${render.item} (registry props schema): connect them to the app.\n${handlers
				.map((name) => `\tfunction ${name}(...args: unknown[]): void {\n\t\tvoid args;\n\t}`)
				.join("\n")}`
		: "";
	const slots = render.slots.length ? `\n<!-- Slots of ${render.item}: ${render.slots.join(", ")} (Svelte snippets, optional). -->` : "";
	return `<!-- ${render.item} / ${render.variant}: UI8Kit registry block (npx ui8kit add ${render.item}). -->
<script lang="ts">
	import ${ident} from "../${render.organism}";

	const props = ${jsonProps(render.props)};${wiring}
</script>
${slots}
<${ident} {...props}${handlers.map((name) => ` {${name}}`).join("")} />
`;
}

/** Section source of one page block (the gate guarantees its item renders; an unknown item is a programming error). */
export function svelteForBlock(block: BlockV2): string {
	const render = renderBlock(block);
	if (!render) throw new Error(`page block ${block.id}: ${block.item} is not a registry item`);
	return sectionForRegistry(render);
}

export function svelteFromPage(page: PageV2): string {
	const roots = page.blocks;
	const imports = roots.map((block) => `import ${identFromBlockId(block.id)} from "./sections/${block.id}.svelte";`);
	const tags = roots.map((block) => `<${identFromBlockId(block.id)} />`).join("\n");
	return `<!-- ${page.title.replace(/--/g, "-")} (${page.slug}): one registry block per section. -->
<script lang="ts">
	${imports.join("\n\t")}
</script>

${tags}
`;
}

/** App.svelte and one section per top-level block (children are the props of their block). */
export function sveltePackFiles(page: PageV2): SourceFile[] {
	return [
		{ path: APP_FILE, content: svelteFromPage(page) },
		...page.blocks.map((block) => ({ path: `${SECTIONS_DIR}/${block.id}.svelte`, content: svelteForBlock(block) }))
	];
}

/**
 * Registry items of the page: `npx ui8kit add <these>` plus `theme-<skin>`
 * when the chat wears a skin of the pinned registry (an unknown skin id is the default theme: no item).
 */
export function registryItemsOf(page: PageV2, skin: string | null = null): string[] {
	const items = new Set<string>();
	for (const block of page.blocks) if (itemInfo(block.item)) items.add(block.item);
	const theme = registrySkin(skin);
	if (theme) items.add(skinItem(theme.id));
	return [...items].sort();
}

/** Registry file paths (project-relative, under src/) of `init` + `add <registryItemsOf(page, skin)>`. */
export function registryPathsOf(page: PageV2, skin: string | null = null): string[] {
	return registryClosure(registryItemsOf(page, skin));
}

/** Registry item names the CLI lock records for this page (`init` + `add`, with registryDependencies). */
export function registryLockItemsOf(page: PageV2, skin: string | null = null): string[] {
	return registryItemClosure(registryItemsOf(page, skin));
}

export { identFromBlockId };

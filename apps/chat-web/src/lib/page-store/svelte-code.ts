/**
 * Page -> Svelte source of a Vite project laid out like `npx ui8kit init` + `npx ui8kit add <items>` (install root
 * `src`): the page is src/App.svelte composing one src/sections/<block-id>.svelte per page block, and every section is a
 * UI8Kit registry block (src/blocks/<item>.svelte) with its props, or the explicit "not in registry" stub (the
 * registry Alert). The registry files themselves come from the pinned snapshot (registry/svelte), never from here.
 */
import { blocksOf, type CreatorPage, type PageBlock } from "@buildytech/page-contract";
import { organismFor, registryClosure, registryItemClosure, type OrganismRender } from "@buildytech/builder-core";

/** CLI install root of the exported project (ui8kit.config.json `dir`, the CLI default). */
export const INSTALL_ROOT = "src";
export const APP_FILE = `${INSTALL_ROOT}/App.svelte`;
export const SECTIONS_DIR = `${INSTALL_ROOT}/sections`;
/** Registry item of the stub section. */
export const STUB_ITEM = "alert";

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
function sectionForRegistry(render: OrganismRender): string {
	const ident = organismIdent(render.organism);
	const handlers = render.events.map((event) => `on${event}`);
	const wiring = handlers.length
		? `\n\n\t// Events of ${render.item} (registry props schema): connect them to the app.\n${handlers
				.map((name) => `\tfunction ${name}(...args: unknown[]): void {\n\t\tvoid args;\n\t}`)
				.join("\n")}`
		: "";
	const slots = render.slots.length ? `\n<!-- Slots of ${render.item}: ${render.slots.join(", ")} (Svelte snippets, optional). -->` : "";
	return `<!-- ${render.catalogBlock} / ${render.variant}: UI8Kit registry block ${render.item} (npx ui8kit add ${render.item}). -->
<script lang="ts">
	import ${ident} from "../${render.organism}";

	const props = ${jsonProps(render.props)};${wiring}
</script>
${slots}
<${ident} {...props}${handlers.map((name) => ` {${name}}`).join("")} />
`;
}

function sectionForStub(block: PageBlock): string {
	const what = `${block.catalogBlock ?? block.kind}${block.variant ? ` / ${block.variant}` : ""}`;
	return `<!-- ${block.kind}: no UI8Kit registry block for ${what}. -->
<script lang="ts">
	import Alert from "../compose/Alert.svelte";

	const message = ${JSON.stringify(`Not in the registry: ${what}`)};
</script>

<Alert variant="destructive" data-slot="registry-stub" data-block-id=${JSON.stringify(block.id)}>{message}</Alert>
`;
}

/** Section source of one page block. */
export function svelteForBlock(block: PageBlock): string {
	const render = organismFor(block);
	return render ? sectionForRegistry(render) : sectionForStub(block);
}

export function svelteFromPage(page: CreatorPage): string {
	const roots = blocksOf(page);
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
export function sveltePackFiles(page: CreatorPage): SourceFile[] {
	return [
		{ path: APP_FILE, content: svelteFromPage(page) },
		...blocksOf(page).map((block) => ({ path: `${SECTIONS_DIR}/${block.id}.svelte`, content: svelteForBlock(block) }))
	];
}

/** Registry items the page's sections import: `npx ui8kit add <these>` (the stub's Alert when a block has none). */
export function registryItemsOf(page: CreatorPage): string[] {
	const items = new Set<string>();
	for (const block of blocksOf(page)) items.add(organismFor(block)?.item ?? STUB_ITEM);
	return [...items].sort();
}

/** Registry file paths (project-relative, under src/) of `init` + `add <registryItemsOf(page)>`. */
export function registryPathsOf(page: CreatorPage): string[] {
	return registryClosure(registryItemsOf(page));
}

/** Registry item names the CLI lock records for this page (`init` + `add`, with registryDependencies). */
export function registryLockItemsOf(page: CreatorPage): string[] {
	return registryItemClosure(registryItemsOf(page));
}

export { identFromBlockId };

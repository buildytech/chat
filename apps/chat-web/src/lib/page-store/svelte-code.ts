import { blocksOf, type CreatorPage, type PageBlock } from "@buildytech/page-contract";

function walkBlocks(blocks: PageBlock[]): PageBlock[] {
	const out: PageBlock[] = [];
	for (const block of blocks) {
		out.push(block);
		if (block.children?.length) out.push(...walkBlocks(block.children));
	}
	return out;
}

function identFromBlockId(id: string): string {
	const cleaned = id.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
	const base = cleaned || "Block";
	const named = /^[A-Za-z]/.test(base) ? base : `Block_${base}`;
	return named[0]!.toUpperCase() + named.slice(1);
}

/** Page-contract copy forbids `<>{}`. Emit that text as Svelte markup; fall back to a string expression if those chars appear. */
function textContent(value: string | undefined | null): string {
	const text = value ?? "";
	if (/[<>{}]/.test(text)) return `{${JSON.stringify(text)}}`;
	return text;
}

function selectedClass(selected: boolean, on: string, off: string): string {
	return JSON.stringify(selected ? on : off);
}

function childImports(block: PageBlock): string[] {
	return (block.children ?? []).map(
		(child) => `import ${identFromBlockId(child.id)} from "./${child.id}.svelte";`
	);
}

function childTags(block: PageBlock): string {
	return (block.children ?? []).map((child) => `\t\t\t<${identFromBlockId(child.id)} />`).join("\n");
}

function primitiveImports(extra: string[]): string[] {
	return [
		...new Set([
			'import Block from "$lib/compose/Block.svelte";',
			'import Stack from "$lib/compose/Stack.svelte";',
			'import Text from "$ui/text/Text.svelte";',
			...extra
		])
	];
}

export function svelteForBlock(block: PageBlock, selectedId: string | null = null): string {
	const selected = selectedId === block.id;
	const copy = block.copy;
	const kind = block.kind;
	const extra: string[] = [];
	if (kind === "hero" || kind === "cta") extra.push('import Button from "$ui/button/Button.svelte";');
	if (kind === "nav") extra.push('import Group from "$lib/compose/Group.svelte";');
	if (kind === "chart") extra.push('import Box from "$ui/box/Box.svelte";');
	if (kind !== "footer") extra.push('import Title from "$lib/compose/Title.svelte";');
	const importLines = [...primitiveImports(extra), ...childImports(block)];
	const imports = importLines.join("\n");
	const border = selectedClass(
		selected,
		"rounded-default border border-primary bg-card px-4 py-4",
		"rounded-default border border-border bg-card px-4 py-4"
	);

	let body = "";
	if (kind === "nav") {
		body = `<Group class="flex-wrap justify-between gap-3">
			<Title as={2} class="text-base font-semibold text-foreground">${textContent(copy?.brand ?? block.title)}</Title>
			<Group class="flex-wrap gap-2">
${childTags(block)}
			</Group>
		</Group>`;
	} else if (kind === "hero") {
		body = `<Stack class="gap-2">
			<Text tag="span" class="text-xs font-medium uppercase tracking-wide text-muted-foreground">${textContent(copy?.eyebrow)}</Text>
			<Title as={2} class="text-xl font-semibold text-foreground">${textContent(copy?.headline ?? block.title)}</Title>
			<Text tag="p" class="text-sm text-muted-foreground">${textContent(copy?.lede)}</Text>
			<Button class="inline-flex w-fit rounded-default bg-primary px-3 py-2 text-sm text-primary-foreground">
				<Text tag="span">${textContent(copy?.action)}</Text>
			</Button>
		</Stack>`;
	} else if (kind === "pagehead") {
		body = `<Stack class="gap-2">
			<Title as={1} class="text-xl font-semibold text-foreground">${textContent(copy?.headline ?? block.title)}</Title>
			<Text tag="p" class="text-sm text-muted-foreground">${textContent(copy?.lede)}</Text>
		</Stack>`;
	} else if (kind === "overview" || kind === "metrics" || kind === "activity") {
		body = `<Stack class="gap-2">
			<Title as={2} class="text-lg font-semibold text-foreground">${textContent(block.title)}</Title>
			<Text tag="p" class="text-sm text-muted-foreground">${textContent(copy?.lede ?? block.summary)}</Text>
${childTags(block)}
		</Stack>`;
	} else if (kind === "chart") {
		body = `<Stack class="gap-2">
			<Title as={2} class="text-lg font-semibold text-foreground">${textContent(block.title)}</Title>
			<Box tag="div" class="flex min-h-32 items-center justify-center rounded-default border border-dashed border-border bg-muted px-4 py-8">
				<Text tag="p" class="text-sm text-muted-foreground">${textContent(copy?.lede ?? block.summary)}</Text>
			</Box>
		</Stack>`;
	} else if (kind === "hours") {
		body = `<Stack class="gap-2">
			<Title as={2} class="text-lg font-semibold text-foreground">${textContent(block.title)}</Title>
			<Text tag="p" class="text-sm text-foreground">${textContent(copy?.days)}</Text>
			<Text tag="p" class="text-sm text-muted-foreground">${textContent(copy?.address)}</Text>
		</Stack>`;
	} else if (kind === "cta") {
		body = `<Stack class="gap-2">
			<Title as={2} class="text-lg font-semibold text-foreground">${textContent(block.title)}</Title>
			<Text tag="p" class="text-sm text-muted-foreground">${textContent(copy?.lede)}</Text>
			<Button class="inline-flex w-fit rounded-default bg-primary px-3 py-2 text-sm text-primary-foreground">
				<Text tag="span">${textContent(copy?.action)}</Text>
			</Button>
			<Text tag="p" class="text-xs text-muted-foreground">${textContent(copy?.note)}</Text>
		</Stack>`;
	} else if (kind === "footer") {
		body = `<Stack class="gap-1">
			<Text tag="p" class="text-sm text-foreground">${textContent(copy?.contact)}</Text>
			<Text tag="p" class="text-xs text-muted-foreground">${textContent(copy?.legal)}</Text>
		</Stack>`;
	} else {
		body = `<Stack class="gap-2">
			<Title as={2} class="text-lg font-semibold text-foreground">${textContent(block.title)}</Title>
			<Text tag="p" class="text-sm text-muted-foreground">${textContent(block.summary)}</Text>
${childTags(block)}
		</Stack>`;
	}

	return `<script lang="ts">
	${imports.split("\n").join("\n\t")}
</script>

<Block tag="article" class=${border} data-block-id=${JSON.stringify(block.id)} data-block-kind=${JSON.stringify(kind)}>
	<Stack class="gap-3">
		<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">${textContent(kind)}</Text>
		${body}
	</Stack>
</Block>
`;
}

export function svelteFromPage(page: CreatorPage, selectedId: string | null = null): string {
	const roots = blocksOf(page);
	const imports = roots.map(
		(block) => `import ${identFromBlockId(block.id)} from "./blocks/${block.id}.svelte";`
	);
	const tags = roots.map((block) => `\t<${identFromBlockId(block.id)} />`).join("\n");
	void selectedId;
	return `<script lang="ts">
	import Block from "$lib/compose/Block.svelte";
	import Stack from "$lib/compose/Stack.svelte";
	${imports.join("\n\t")}
</script>

<Block tag="main" data-page-id=${JSON.stringify(page.id)} data-page-slug=${JSON.stringify(page.slug)} data-page-status=${JSON.stringify(page.status)}>
	<Stack class="gap-4">
${tags}
	</Stack>
</Block>
`;
}

export function sveltePackFiles(
	page: CreatorPage,
	selectedId: string | null = null
): { path: string; content: string }[] {
	const files: { path: string; content: string }[] = [
		{ path: "page.svelte", content: svelteFromPage(page, selectedId) }
	];
	for (const block of walkBlocks(blocksOf(page))) {
		files.push({
			path: `blocks/${block.id}.svelte`,
			content: svelteForBlock(block, selectedId)
		});
	}
	return files;
}

export { identFromBlockId };

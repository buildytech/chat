<script lang="ts">
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Link from "$registry/kit/ui/link/Link.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Title from "$registry/compose/Title.svelte";
	import { parseMarkdown, type MdInline } from "$lib/chat-core/markdown";

	// Model Markdown parsed into tokens and rendered with kit primitives: never HTML, links only http(s).
	let { source }: { source: string } = $props();

	const blocks = $derived(parseMarkdown(source));
</script>

{#snippet inline(parts: MdInline[])}
	{#each parts as part, index (index)}
		{#if part.type === "strong"}
			<Text tag="strong" class="font-semibold">{part.text}</Text>
		{:else if part.type === "em"}
			<Text tag="em">{part.text}</Text>
		{:else if part.type === "code"}
			<Text tag="code" class="rounded bg-muted px-2 font-mono text-xs">{part.text}</Text>
		{:else if part.type === "link"}
			<Link href={part.href} target="_blank" rel="noopener noreferrer" class="underline underline-offset-4">{part.text}</Link>
		{:else}
			{part.text}
		{/if}
	{/each}
{/snippet}

<Stack align="stretch" class="gap-4 text-sm text-foreground" data-slot="markdown">
	{#each blocks as block, index (index)}
		{#if block.type === "heading"}
			<Title as={block.level === 1 ? 3 : 4} class="text-sm font-semibold text-foreground">{@render inline(block.inline)}</Title>
		{:else if block.type === "paragraph"}
			<Text tag="p" class="leading-6">{@render inline(block.inline)}</Text>
		{:else if block.type === "list"}
			<Box tag={block.ordered ? "ol" : "ul"} class={block.ordered ? "flex list-decimal flex-col gap-2 pl-6" : "flex list-disc flex-col gap-2 pl-6"}>
				{#each block.items as item, itemIndex (itemIndex)}
					<Box tag="li" class="leading-6">{@render inline(item)}</Box>
				{/each}
			</Box>
		{:else}
			<Text tag="pre" class="overflow-x-auto rounded bg-muted px-4 py-2 font-mono text-xs">{block.text}</Text>
		{/if}
	{/each}
</Stack>

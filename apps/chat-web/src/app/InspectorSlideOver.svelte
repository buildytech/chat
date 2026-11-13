<!--
  Inspector slide-over (ADR 0024 step D): a fixed-width panel over the right edge of the preview, not a column and
  not a modal. The preview stays visible next to it (no backdrop) and the left panel stays usable; it is a
  complementary landmark labelled by its heading. It opens on the section picked in the preview or in Sections, with
  the picked field focused, closes with Escape or the close button, and its open state is remembered. Fields, rows,
  validation and undo are the inspector's own (InspectorPanel).
-->
<script lang="ts">
import { X } from "$lib/shell-icons";
	import Block from "$registry/compose/Block.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Title from "$registry/compose/Title.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { topLevelBlockId } from "$lib/inspector/geometry";
	import { inspectorPanel } from "$lib/inspector/panel.svelte";
	import { blocksOf, getCurrentPage, getSelectedBlockId } from "$lib/page-store";
	import InspectorPanel from "./InspectorPanel.svelte";

	const block = $derived.by(() => {
		const page = getCurrentPage();
		const blocks = page ? blocksOf(page) : [];
		const id = topLevelBlockId(blocks, getSelectedBlockId());
		return blocks.find((node) => node.id === id) ?? null;
	});
</script>

<Block
	tag="aside"
	id="creator-inspector"
	class="absolute inset-y-0 right-0 z-30 flex w-80 max-w-full flex-col border-l border-border bg-popover shadow-lg"
	aria-labelledby="inspector-slideover-title"
	data-slot="inspector-slideover"
>
	<Group class="h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
		<Title as={2} id="inspector-slideover-title" class="min-w-0 truncate text-xs font-semibold text-foreground">
			{block ? t("inspector.on").replace("{title}", block.title) : t("inspector.title")}
		</Title>
		<Button size="sm" layout="icon" variant="ghost" class="size-6 px-0" aria-label={t("inspector.close")} title={`${t("inspector.close")} (Esc)`} data-action="inspector-close" onclick={() => inspectorPanel.close()}>
			<X />
		</Button>
	</Group>
	<Stack align="stretch" id="inspector-properties" tabindex={-1} class="min-h-0 flex-1 overflow-y-auto" data-slot="inspector-properties">
		<InspectorPanel />
	</Stack>
</Block>

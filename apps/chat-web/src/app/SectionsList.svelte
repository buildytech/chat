<!--
  Sections tab (ADR 0024 step B): the current page's top-level sections in page order, each with its Stock thumbnail,
  title and spec / variant. Reorder by dragging the handle (pointer), with the up / down buttons, or with Alt+Arrow
  Up / Down on a focused section (announced in a live region); remove a section; change the selected section's
  variant. Every action is an inspector operation (page-spec, props and catalog gates, one undo step, no model
  call). Selection is the page store's: a click here selects and reveals the section in the preview, a pick in the
  preview highlights it here.
-->
<script lang="ts">
	import ArrowDown from "@lucide/svelte/icons/arrow-down";
	import ArrowUp from "@lucide/svelte/icons/arrow-up";
	import GripVertical from "@lucide/svelte/icons/grip-vertical";
	import Redo2 from "@lucide/svelte/icons/redo-2";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import Undo2 from "@lucide/svelte/icons/undo-2";
	import Block from "$registry/compose/Block.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Select from "$registry/compose/Select.svelte";
	import SelectOption from "$registry/compose/SelectOption.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { canvas } from "$lib/inspector/canvas.svelte";
	import { inspector } from "$lib/inspector/inspector.svelte";
	import { topLevelBlockId } from "$lib/inspector/geometry";
	import { dropIndex, stepIndex } from "$lib/feed/sections";
	import { blocksOf, getCurrentPage, getSelectedBlockId, selectBlock, type PageBlock } from "$lib/page-store";
	import { blockThumbUrl, catalogVariantsFor } from "@buildytech/builder-core";
	import StockThumb from "./StockThumb.svelte";

	const page = $derived(getCurrentPage());
	const sections = $derived(page ? blocksOf(page) : []);
	const selected = $derived(topLevelBlockId(sections, getSelectedBlockId()));
	let announcement = $state("");
	let issue = $state<string | null>(null);
	let drag = $state<{ id: string; from: number; to: number; pointer: number } | null>(null);
	const listEl = () => document.querySelector<HTMLElement>('[data-slot="sections-list"]');

	const fill = (key: string, block: PageBlock, extra: Record<string, string | number> = {}) => {
		let text = t(key).replace("{title}", block.title);
		for (const [name, value] of Object.entries(extra)) text = text.replace(`{${name}}`, String(value));
		return text;
	};
	const variantsOf = (block: PageBlock) => (block.catalogBlock ? catalogVariantsFor(block.catalogBlock) : []);
	const itemId = (id: string) => `section-item-${id}`;

	function focusItem(id: string) {
		queueMicrotask(() => document.getElementById(itemId(id))?.focus());
	}

	function pick(block: PageBlock) {
		selectBlock(block.id);
		canvas.requestReveal(block.id);
	}

	function run(ok: boolean, text: string, block: PageBlock) {
		const failed = ok ? null : inspector.opIssueFor(block.id);
		issue = failed ? failed.message : null;
		announcement = ok ? text : t("sections.failed").replace("{message}", failed?.message ?? "");
	}

	function move(block: PageBlock, to: number) {
		const from = sections.findIndex((node) => node.id === block.id);
		if (from < 0 || to === from) return;
		const ok = inspector.run({ op: "move", blockId: block.id, to });
		run(ok, fill("sections.moved", block, { position: to + 1, count: sections.length }), block);
		if (ok) {
			canvas.requestReveal(block.id);
			focusItem(block.id);
		}
	}

	function remove(block: PageBlock) {
		const index = sections.findIndex((node) => node.id === block.id);
		const ok = inspector.run({ op: "remove", blockId: block.id });
		run(ok, fill("sections.removed", block), block);
		const next = sections[Math.min(index, sections.length - 1)];
		if (ok && next) focusItem(next.id);
	}

	function setVariant(block: PageBlock, variant: string) {
		const ok = inspector.run({ op: "set_variant", blockId: block.id, variant });
		run(ok, fill("sections.variantSet", block, { variant }), block);
	}

	// Alt+Arrow Up / Down moves the focused section; plain arrows move the focus; Home / End jump.
	function onKey(event: KeyboardEvent, block: PageBlock, index: number) {
		if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "Home" && event.key !== "End") return;
		event.preventDefault();
		if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
			const to = stepIndex(index, event.key === "ArrowUp" ? -1 : 1, sections.length);
			if (to === null) announcement = fill(event.key === "ArrowUp" ? "sections.atTop" : "sections.atBottom", block);
			else move(block, to);
			return;
		}
		const target = event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : stepIndex(index, event.key === "ArrowUp" ? -1 : 1, sections.length);
		if (target !== null && sections[target]) focusItem(sections[target]!.id);
	}

	// Pointer drag on the handle: the pointer is captured, the list shows where the section lands, release moves it.
	function boxes(): Array<{ top: number; height: number }> {
		const list = listEl();
		if (!list) return [];
		return [...list.querySelectorAll<HTMLElement>("[data-section-id]")].map((el) => {
			const rect = el.getBoundingClientRect();
			return { top: rect.top, height: rect.height };
		});
	}

	function onPointerDown(event: PointerEvent, block: PageBlock, index: number) {
		if (event.button !== 0) return;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		drag = { id: block.id, from: index, to: index, pointer: event.pointerId };
	}

	function onPointerMove(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointer) return;
		drag = { ...drag, to: dropIndex(boxes(), event.clientY, drag.from) };
	}

	function onPointerUp(event: PointerEvent, block: PageBlock) {
		if (!drag || event.pointerId !== drag.pointer) return;
		const to = drag.to;
		drag = null;
		move(block, to);
	}

	function onPointerCancel() {
		drag = null;
	}

	// A pick in the preview scrolls its section into view here.
	$effect(() => {
		void sections;
		if (!selected) return;
		listEl()?.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: "nearest" });
	});
</script>

<Block tag="section" class="flex min-h-0 flex-1 flex-col" aria-label={t("leftPanel.sections")} data-slot="sections">
	<Group class="shrink-0 items-center justify-between gap-2 border-b border-border px-2 py-1">
		<Text tag="span" class="text-xs text-muted-foreground" id="sections-help">{t("sections.help")}</Text>
		<Group class="shrink-0 items-center gap-1">
			<Button size="sm" layout="icon" variant="ghost" class="size-6 px-0" disabled={!inspector.canUndo} aria-label={t("sections.undo")} title={`${t("sections.undo")} (Ctrl+Z)`} data-action="sections-undo" onclick={() => inspector.undo()}>
				<Undo2 />
			</Button>
			<Button size="sm" layout="icon" variant="ghost" class="size-6 px-0" disabled={!inspector.canRedo} aria-label={t("sections.redo")} title={`${t("sections.redo")} (Ctrl+Shift+Z)`} data-action="sections-redo" onclick={() => inspector.redo()}>
				<Redo2 />
			</Button>
		</Group>
	</Group>
	<Text tag="p" class="sr-only" role="status" aria-live="assertive" data-slot="sections-live">{announcement}</Text>
	{#if issue}
		<Text tag="p" class="shrink-0 px-2 pt-2 text-xs text-destructive" data-slot="sections-issue">{issue}</Text>
	{/if}
	<Box class="min-h-0 flex-1 overflow-y-auto p-2">
		{#if sections.length === 0}
			<Text tag="p" class="text-xs text-muted-foreground">{t("sections.empty")}</Text>
		{:else}
			<Box tag="ul" class="flex flex-col gap-1" aria-label={t("sections.list")} aria-describedby="sections-help" data-slot="sections-list">
				{#each sections as block, index (block.id)}
					{@const isSelected = selected === block.id}
					{@const variants = variantsOf(block)}
					<Box
						tag="li"
						class={cn(
							"rounded border bg-card p-1",
							isSelected ? "border-primary" : "border-border",
							drag?.id === block.id && "opacity-60",
							drag && drag.id !== block.id && drag.to === index && (drag.to < drag.from ? "border-t-2 border-t-primary" : "border-b-2 border-b-primary")
						)}
						data-section-id={block.id}
						data-index={index}
					>
						<Group class="min-w-0 items-center gap-1">
							<Button
								size="sm"
								layout="icon"
								variant="ghost"
								class="size-6 shrink-0 cursor-grab touch-none px-0 text-muted-foreground"
								aria-label={fill("sections.drag", block)}
								title={fill("sections.drag", block)}
								data-action="section-drag"
								onpointerdown={(event: PointerEvent) => onPointerDown(event, block, index)}
								onpointermove={onPointerMove}
								onpointerup={(event: PointerEvent) => onPointerUp(event, block)}
								onpointercancel={onPointerCancel}
								onkeydown={(event: KeyboardEvent) => onKey(event, block, index)}
							>
								<GripVertical />
							</Button>
							<Button
								id={itemId(block.id)}
								variant="ghost"
								class="h-auto min-w-0 flex-1 justify-start gap-2 px-1 py-0 text-left"
								pressed={isSelected}
								aria-describedby="sections-help"
								data-action="section-select"
								onclick={() => pick(block)}
								onkeydown={(event: KeyboardEvent) => onKey(event, block, index)}
								onpointerenter={() => canvas.hover(block.id)}
								onpointerleave={() => canvas.hover(null)}
							>
								<StockThumb src={blockThumbUrl(block.catalogBlock ?? "", block.variant)} title={block.title} class="w-14" />
								<Stack align="stretch" class="min-w-0 flex-1 gap-0">
									<Text tag="span" class="truncate text-xs font-medium text-foreground">{block.title}</Text>
									<Text tag="span" class="truncate font-mono text-[11px] text-muted-foreground">{block.catalogBlock ?? block.kind}{block.variant ? `/${block.variant}` : ""}</Text>
								</Stack>
							</Button>
							<Group class="shrink-0 items-center gap-0">
								<Button size="sm" layout="icon" variant="ghost" class="size-6 px-0" disabled={index === 0} aria-label={fill("sections.up", block)} title={fill("sections.up", block)} data-action="section-up" onclick={() => move(block, index - 1)}>
									<ArrowUp />
								</Button>
								<Button size="sm" layout="icon" variant="ghost" class="size-6 px-0" disabled={index === sections.length - 1} aria-label={fill("sections.down", block)} title={fill("sections.down", block)} data-action="section-down" onclick={() => move(block, index + 1)}>
									<ArrowDown />
								</Button>
								<Button size="sm" layout="icon" variant="ghost" class="size-6 px-0 text-muted-foreground hover:text-destructive" aria-label={fill("sections.remove", block)} title={fill("sections.remove", block)} data-action="section-remove" onclick={() => remove(block)}>
									<Trash2 />
								</Button>
							</Group>
						</Group>
						{#if isSelected && variants.length > 1}
							<Select
								size="sm"
								class="mt-1 h-8 w-full text-xs"
								value={block.variant ?? ""}
								aria-label={fill("sections.variant", block)}
								data-action="section-variant"
								onchange={(event: Event) => setVariant(block, (event.currentTarget as HTMLSelectElement).value)}
							>
								{#each variants as option (option)}
									<SelectOption value={option}>{option}</SelectOption>
								{/each}
							</Select>
						{/if}
					</Box>
				{/each}
			</Box>
		{/if}
	</Box>
</Block>

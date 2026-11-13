<!--
  Sections tab (ADR 0024 step B): the current page's top-level sections in page order, each with its Stock thumbnail,
  title and spec. Reorder by dragging the handle (pointer), with the up / down buttons, or with Alt+Arrow
  Up / Down on a focused section (announced in a live region); remove a section. Variant and screen family are not
  picked here: the variant lives in the inspector, and the family stays an advisory note on the chat column.
  Every action is an inspector operation (page-spec, props and catalog gates, one undo step, no model call).
  Selection is the page store's: a click here selects and reveals the section in the preview, a pick in the
  preview highlights it here. A Blocks feed card dragged here (the Sections tab opens when the drag rests on it)
  drops between rows through the same add operation as "+" (ADR 0024 step C).
-->
<script lang="ts">
import { ArrowDown, ArrowUp, GripVertical, Redo2, Trash2, Undo2 } from "$lib/shell-icons";
	import Block from "$registry/compose/Block.svelte";
	import Badge from "$registry/compose/Badge.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { canvas } from "$lib/inspector/canvas.svelte";
	import { inspector } from "$lib/inspector/inspector.svelte";
	import { topLevelBlockId } from "$lib/inspector/geometry";
	import { dropIndex, insertionSlot, stepIndex } from "$lib/feed/sections";
	import { feedDrag } from "$lib/feed/drag.svelte";
	import { dropAt, dropRefusal, refuseDrop } from "$lib/feed/drop.svelte";
	import { blocksOf, getCurrentPage, getSelectedBlockId, selectBlock, type PageBlock } from "$lib/page-store";
	import { blockThumbUrl, moveSlotCheck } from "@buildytech/builder-core";
	import { inspectorPanel } from "$lib/inspector/panel.svelte";
	import StockThumb from "./StockThumb.svelte";

	const page = $derived(getCurrentPage());
	const sections = $derived(page ? blocksOf(page) : []);
	const selected = $derived(topLevelBlockId(sections, getSelectedBlockId()));
	let announcement = $state("");
	let issue = $state<string | null>(null);
	let drag = $state<{ id: string; from: number; to: number; pointer: number; refusal: string | null } | null>(null);
	/** Codes of the header / footer position rules (moves and drops say them the same way). */
	const SLOT_CODES = new Set(["index_out_of_range", "above_header", "below_footer", "header_top", "footer_end"]);
	const listEl = () => document.querySelector<HTMLElement>('[data-slot="sections-list"]');

	const fill = (key: string, block: PageBlock, extra: Record<string, string | number> = {}) => {
		let text = t(key).replace("{title}", block.title);
		for (const [name, value] of Object.entries(extra)) text = text.replace(`{${name}}`, String(value));
		return text;
	};
	const itemId = (id: string) => `section-item-${id}`;

	function focusItem(id: string) {
		queueMicrotask(() => document.getElementById(itemId(id))?.focus());
	}

	// A row click selects the section, reveals it in the preview and opens the inspector on it (focus stays here).
	function pick(block: PageBlock) {
		selectBlock(block.id);
		canvas.requestReveal(block.id);
		inspectorPanel.show(document.getElementById(itemId(block.id)));
	}

	function moveRefusal(from: number, to: number): string | null {
		if (from === to) return null;
		const check = moveSlotCheck(sections, from, to);
		return check.ok ? null : t(`dnd.why.${check.code}`);
	}

	function run(ok: boolean, text: string, block: PageBlock) {
		const failed = ok ? null : inspector.opIssueFor(block.id);
		const message = failed ? (SLOT_CODES.has(failed.code) ? t(`dnd.why.${failed.code}`) : failed.message) : "";
		issue = failed ? message : null;
		announcement = ok ? text : t("sections.failed").replace("{message}", message);
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
		drag = { id: block.id, from: index, to: index, pointer: event.pointerId, refusal: null };
	}

	function onPointerMove(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointer) return;
		const to = dropIndex(boxes(), event.clientY, drag.from);
		drag = { ...drag, to, refusal: moveRefusal(drag.from, to) };
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

	// A Blocks feed card dropped between rows (ADR 0024 step C): the same add operation as "+", at that slot.
	let feedTarget = $state<{ slot: number; refusal: string | null } | null>(null);

	function onFeedOver(event: DragEvent) {
		if (!feedDrag.active) return;
		const { slot } = insertionSlot(boxes(), event.clientY);
		const refusal = dropRefusal(sections.length ? slot : 0);
		feedTarget = { slot, refusal };
		// The drop is always taken, so a refused one is said (red line and label now, the reason in the status on release).
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
	}

	async function onFeedDrop(event: DragEvent) {
		event.preventDefault();
		const target = feedTarget;
		const item = feedDrag.item;
		feedTarget = null;
		if (!target || !item) return;
		if (target.refusal) {
			refuseDrop(target.refusal);
			announcement = feedDrag.status?.text ?? "";
			return;
		}
		await dropAt(target.slot);
		announcement = feedDrag.status?.text ?? "";
		issue = feedDrag.status?.ok === false ? feedDrag.status.text : null;
	}

	function onFeedLeave(event: DragEvent) {
		const zone = event.currentTarget as HTMLElement;
		if (event.relatedTarget instanceof Node && zone.contains(event.relatedTarget)) return;
		feedTarget = null;
	}

	$effect(() => {
		if (!feedDrag.active) feedTarget = null;
	});

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
	{#if drag?.refusal}
		<Text tag="p" class="shrink-0 px-2 pt-2 text-xs text-destructive" data-slot="sections-move-refusal">{drag.refusal}</Text>
	{:else if feedTarget?.refusal}
		<Text tag="p" class="shrink-0 px-2 pt-2 text-xs text-destructive" data-slot="sections-drop-refusal">{feedTarget.refusal}</Text>
	{:else if issue}
		<Text tag="p" class="shrink-0 px-2 pt-2 text-xs text-destructive" data-slot="sections-issue">{issue}</Text>
	{/if}
	<Box
		class={cn("min-h-0 flex-1 overflow-y-auto p-2", feedDrag.active && "bg-accent/40")}
		data-slot="sections-drop"
		ondragover={onFeedOver}
		ondragleave={onFeedLeave}
		ondrop={onFeedDrop}
	>
		{#if sections.length === 0}
			<Text tag="p" class="text-xs text-muted-foreground">{t("sections.empty")}</Text>
		{:else}
			<Box tag="ul" class="flex flex-col gap-1" aria-label={t("sections.list")} aria-describedby="sections-help" data-slot="sections-list">
				{#each sections as block, index (block.id)}
					{@const isSelected = selected === block.id}
					<Box
						tag="li"
						class={cn(
							"relative rounded border bg-card p-1",
							isSelected ? "border-input bg-accent" : "border-border",
							drag?.id === block.id && "opacity-60",
							drag && drag.id !== block.id && drag.to === index && (drag.to < drag.from ? "border-t-2" : "border-b-2"),
							drag && drag.id !== block.id && drag.to === index && (drag.refusal ? (drag.to < drag.from ? "border-t-destructive" : "border-b-destructive") : drag.to < drag.from ? "border-t-primary" : "border-b-primary"),
							feedTarget && feedTarget.slot === index && (feedTarget.refusal ? "border-t-2 border-t-destructive" : "border-t-2 border-t-primary"),
							feedTarget && index === sections.length - 1 && feedTarget.slot === sections.length && (feedTarget.refusal ? "border-b-2 border-b-destructive" : "border-b-2 border-b-primary")
						)}
						data-drop-before={feedTarget?.slot === index ? (feedTarget.refusal ? "refused" : "ok") : undefined}
						data-section-id={block.id}
						data-index={index}
					>
						{#if feedTarget && (feedTarget.slot === index || (index === sections.length - 1 && feedTarget.slot === sections.length))}
							<Badge
								size="sm"
								variant={feedTarget.refusal ? "destructive" : "default"}
								class={cn("pointer-events-none absolute left-8 z-10", feedTarget.slot === index ? "-top-3" : "-bottom-3")}
								data-slot="sections-drop-label"
							>
								{feedTarget.refusal ?? t("dnd.insertAt").replace("{position}", String(feedTarget.slot + 1))}
							</Badge>
						{/if}
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
					</Box>
				{/each}
			</Box>
		{/if}
	</Box>
</Block>

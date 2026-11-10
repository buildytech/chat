<!--
  Build inspector of the selected section (ADR 0014): its registry item, variant and every prop of its published
  schema (registry/props.v0.json) with the value the preview renders. Fields that map to page content are editable;
  the rest are shown read-only with where they come from. A section without a registry block or schema gets an
  honest stub; no field is invented.
-->
<script lang="ts">
	import ArrowDown from "@lucide/svelte/icons/arrow-down";
	import ArrowUp from "@lucide/svelte/icons/arrow-up";
	import Copy from "@lucide/svelte/icons/copy";
	import Redo2 from "@lucide/svelte/icons/redo-2";
	import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
	import Undo2 from "@lucide/svelte/icons/undo-2";
	import { onMount } from "svelte";
	import Alert from "$registry/compose/Alert.svelte";
	import Badge from "$registry/compose/Badge.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Block from "$registry/compose/Block.svelte";
	import Disclosure from "$registry/compose/Disclosure.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Select from "$registry/compose/Select.svelte";
	import SelectOption from "$registry/compose/SelectOption.svelte";
	import Field from "$registry/components/field.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Summary from "$registry/compose/Summary.svelte";
	import Text from "$registry/compose/Text.svelte";
	import { inspectorModel } from "@buildytech/builder-core";
	import { loadPropsGate } from "$lib/chat-core";
	import { t } from "$lib/i18n/dictionary";
	import { partitionFields, type FieldHandlers } from "$lib/inspector/fields";
	import { inspector } from "$lib/inspector/inspector.svelte";
	import { topLevelBlockId } from "$lib/inspector/geometry";
	import { blocksOf, getCurrentPage, getSelectedBlockId } from "$lib/page-store";
	import InspectorFields from "./InspectorFields.svelte";

	const blocks = $derived.by(() => {
		const page = getCurrentPage();
		return page ? blocksOf(page) : [];
	});
	const block = $derived.by(() => {
		const id = topLevelBlockId(blocks, getSelectedBlockId());
		return blocks.find((node) => node.id === id) ?? null;
	});
	const model = $derived(block ? inspectorModel(block) : null);
	const parts = $derived(model?.ok ? partitionFields(model.fields) : { main: [], more: [] });
	const issues = $derived(model ? inspector.issuesFor(model.blockId) : {});
	const index = $derived(model ? blocks.findIndex((node) => node.id === model.blockId) : -1);
	const opIssue = $derived(model ? inspector.opIssueFor(model.blockId) : null);
	const handlers: FieldHandlers = {
		onedit: (field, value, typing) => {
			if (model) inspector.edit(model.blockId, field, value, typing);
		},
		onseal: () => inspector.seal(),
		onrow: (row, action) => {
			if (model) inspector.run({ op: action === "duplicate" ? "duplicate_row" : "remove_row", blockId: model.blockId, row });
		}
	};

	function setVariant(event: Event) {
		if (!model) return;
		inspector.run({ op: "set_variant", blockId: model.blockId, variant: (event.currentTarget as HTMLSelectElement).value });
	}

	// The props gate (Ajv over the pinned schemas) is a lazy chunk; edits fail closed until it is loaded.
	onMount(() => {
		void loadPropsGate().catch(() => {});
	});
</script>

<svelte:window onkeydown={inspector.onKey} />

<Block
	tag="aside"
	class="shrink-0 overflow-y-auto rounded border border-border bg-card p-4 max-lg:max-h-96 lg:w-80"
	aria-label={t("inspector.title")}
	data-slot="inspector"
	data-block-id={model?.blockId}
	data-registry-item={model?.ok ? model.item : undefined}
	data-variant={model?.ok ? model.variant : undefined}
>
	<Stack align="stretch" gap="4">
		<Group gap="2" justify="between">
			<Group gap="2">
				<Icon size="sm"><SlidersHorizontal /></Icon>
				<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("inspector.title")}</Text>
			</Group>
			<Group gap="2" role="group" aria-label={t("inspector.history")}>
				<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.undo")} title={t("inspector.undoKey")} disabled={!inspector.canUndo} onclick={() => inspector.undo()} data-action="undo">
					<Undo2 />
				</Button>
				<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.redo")} title={t("inspector.redoKey")} disabled={!inspector.canRedo} onclick={() => inspector.redo()} data-action="redo">
					<Redo2 />
				</Button>
			</Group>
		</Group>
		{#if !model}
			<Text tag="p" class="text-sm text-muted-foreground">{t("inspector.empty")}</Text>
		{:else}
			<Stack align="stretch" gap="2">
				<Text tag="p" class="truncate text-sm font-semibold text-foreground">{model.title}</Text>
				<Group gap="2" class="flex-wrap">
					<Badge size="sm" variant="secondary">{model.kind}</Badge>
					{#if model.ok}
						<Badge size="sm" variant="outline">{model.item}</Badge>
						<Badge size="sm" variant="outline">{model.variant}</Badge>
					{/if}
				</Group>
			</Stack>
			<Group gap="2" class="flex-wrap" role="group" aria-label={t("inspector.actions")} data-slot="inspector-actions">
				<Button size="sm" layout="icon" variant="outline" aria-label={t("inspector.moveUp")} title={t("inspector.moveUp")} disabled={index <= 0} data-action="move-up" onclick={() => inspector.run({ op: "move", blockId: model.blockId, to: index - 1 })}>
					<ArrowUp />
				</Button>
				<Button size="sm" layout="icon" variant="outline" aria-label={t("inspector.moveDown")} title={t("inspector.moveDown")} disabled={index < 0 || index >= blocks.length - 1} data-action="move-down" onclick={() => inspector.run({ op: "move", blockId: model.blockId, to: index + 1 })}>
					<ArrowDown />
				</Button>
				<Button size="sm" layout="icon" variant="outline" aria-label={t("inspector.duplicate")} title={t("inspector.duplicate")} data-action="duplicate" onclick={() => inspector.run({ op: "duplicate", blockId: model.blockId })}>
					<Copy />
				</Button>
				<Button size="sm" layout="icon" variant="outline" aria-label={t("inspector.reset")} title={t("inspector.reset")} disabled={!model.ok} data-action="reset" onclick={() => inspector.run({ op: "reset", blockId: model.blockId })}>
					<RotateCcw />
				</Button>
				<Button size="sm" layout="icon" variant="outline" aria-label={t("inspector.remove")} title={t("inspector.remove")} data-action="remove" onclick={() => inspector.run({ op: "remove", blockId: model.blockId })}>
					<Trash2 />
				</Button>
			</Group>
			{#if opIssue}
				<Alert variant="destructive" role="alert" data-slot="inspector-op-issue">{opIssue.message}</Alert>
			{/if}
			{#if !model.ok}
				<Alert variant="warning" data-slot="inspector-stub">{t(`inspector.stub.${model.reason}`)}</Alert>
			{:else}
				{#if model.variants.length > 1}
					<Field label={t("inspector.variant")} htmlFor={`insp-${model.blockId}-variant`}>
						<Select id={`insp-${model.blockId}-variant`} size="sm" value={model.variant} data-action="variant" onchange={setVariant}>
							{#each model.variants as option (option)}
								<SelectOption value={option}>{option}</SelectOption>
							{/each}
						</Select>
					</Field>
				{/if}
				<InspectorFields fields={parts.main} blockId={model.blockId} variant={model.variant} {issues} {handlers} />
				{#if parts.more.length}
					<Disclosure variant="ghost" data-slot="inspector-more">
						<Summary size="sm">{t("inspector.more").replace("{count}", String(parts.more.length))}</Summary>
						<Stack align="stretch" gap="4" class="pt-4">
							<InspectorFields fields={parts.more} blockId={model.blockId} variant={model.variant} {issues} {handlers} />
						</Stack>
					</Disclosure>
				{/if}
			{/if}
		{/if}
	</Stack>
</Block>

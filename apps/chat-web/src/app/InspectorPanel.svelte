<!--
  Build inspector of the selected section (ADR 0014): its registry item, variant and every prop of its published
  schema (registry/props.v0.json) with the value the preview renders. Fields that map to page content are editable;
  the rest are shown read-only with where they come from. A section without a registry block or schema gets an
  honest stub; no field is invented.
-->
<script lang="ts">
	import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
	import Alert from "$registry/compose/Alert.svelte";
	import Badge from "$registry/compose/Badge.svelte";
	import Block from "$registry/compose/Block.svelte";
	import Disclosure from "$registry/compose/Disclosure.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Summary from "$registry/compose/Summary.svelte";
	import Text from "$registry/compose/Text.svelte";
	import { inspectorModel } from "@buildytech/builder-core";
	import { t } from "$lib/i18n/dictionary";
	import { partitionFields, type FieldHandlers, type FieldIssue } from "$lib/inspector/fields";
	import { topLevelBlockId } from "$lib/inspector/geometry";
	import { blocksOf, getCurrentPage, getSelectedBlockId } from "$lib/page-store";
	import InspectorFields from "./InspectorFields.svelte";

	let { issues = {}, handlers }: { issues?: Record<string, FieldIssue>; handlers?: FieldHandlers } = $props();

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
</script>

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
		<Group gap="2">
			<Icon size="sm"><SlidersHorizontal /></Icon>
			<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("inspector.title")}</Text>
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
			{#if !model.ok}
				<Alert variant="warning" data-slot="inspector-stub">{t(`inspector.stub.${model.reason}`)}</Alert>
			{:else}
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

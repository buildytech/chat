<!-- One plain value of a list of values or of a map: the widget of its kind, written straight into the props at its pointer. -->
<script lang="ts">
	import Checkbox from "$registry/compose/Checkbox.svelte";
	import Input from "$registry/compose/Input.svelte";
	import Select from "$registry/compose/Select.svelte";
	import SelectOption from "$registry/compose/SelectOption.svelte";
	import { inspectorShown, type InspectorField } from "@buildytech/builder-core";
	import { text, valueOf, type FieldHandlers, type FieldIssue } from "$lib/inspector/fields";

	let { item, itemId, issues, handlers }: { item: InspectorField; itemId: string; issues: Record<string, FieldIssue>; handlers: FieldHandlers } = $props();
</script>

	{#if item.widget === "enum"}
		<Select
			id={itemId}
			size="sm"
			class="min-w-0 flex-1"
			aria-label={item.name}
			value={text(item.value)}
			onchange={(event: Event) => handlers.onedit(item, (event.currentTarget as HTMLSelectElement).value, false)}
		>
			{#each item.options ?? [] as option (option)}
				<SelectOption value={option}>{option}</SelectOption>
			{/each}
		</Select>
	{:else if item.widget === "boolean"}
		<Checkbox
			id={itemId}
			aria-label={item.name}
			checked={item.value === true}
			onchange={(event: Event) => handlers.onedit(item, String((event.currentTarget as HTMLInputElement).checked), false)}
		/>
	{:else if item.widget === "number"}
		<Input
			id={itemId}
			size="sm"
			type="number"
			step={item.money ? "any" : undefined}
			class="min-w-0 flex-1"
			aria-label={item.name}
			state={issues[item.pointer] ? "error" : undefined}
			value={inspectorShown(item)}
			onchange={(event: Event) => handlers.onedit(item, valueOf(event), false)}
		/>
	{:else}
		<Input
			id={itemId}
			size="sm"
			class="min-w-0 flex-1"
			aria-label={item.name}
			state={issues[item.pointer] ? "error" : undefined}
			value={text(item.value)}
			oninput={(event: Event) => handlers.onedit(item, valueOf(event), true)}
			onblur={() => handlers.onseal()}
		/>
	{/if}

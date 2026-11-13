<!--
  Inspector fields of one level of a block's props (top level, an object prop or a list row), one registry widget per
  schema kind (ADR 0034). Every field is editable and writes straight into the block's props at its JSON Pointer; the
  write is validated against the item's props schema. Lists add, duplicate, remove and reorder rows. Rejected edits show
  the gate's message and, for an enum, the allowed values. Focus in a field selects it on the canvas (ADR 0021): the
  overlay outlines where the preview shows it.
-->
<script lang="ts">
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "$lib/shell-icons";
	import Box from "$registry/compose/Box.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Checkbox from "$registry/compose/Checkbox.svelte";
	import Fieldset from "$registry/compose/Fieldset.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Input from "$registry/compose/Input.svelte";
	import Label from "$registry/compose/Label.svelte";
	import Legend from "$registry/compose/Legend.svelte";
	import Select from "$registry/compose/Select.svelte";
	import SelectOption from "$registry/compose/SelectOption.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Text from "$registry/compose/Text.svelte";
	import Textarea from "$registry/compose/Textarea.svelte";
	import Field from "$registry/components/field.svelte";
	import type { InspectorField } from "@buildytech/builder-core";
	import { t } from "$lib/i18n/dictionary";
	import { canvas } from "$lib/inspector/canvas.svelte";
	import { closestAllowed, fieldDomId, issueText, type FieldHandlers, type FieldIssue } from "$lib/inspector/fields";
	import Self from "./InspectorFields.svelte";

	let {
		fields,
		blockId,
		issues = {},
		handlers
	}: {
		fields: InspectorField[];
		blockId: string;
		issues?: Record<string, FieldIssue>;
		handlers: FieldHandlers;
	} = $props();

	function text(value: unknown): string {
		if (value === undefined || value === null) return "";
		return typeof value === "string" ? value : JSON.stringify(value);
	}

	function errorOf(field: InspectorField): string | undefined {
		const issue = issues[field.pointer];
		if (!issue) return undefined;
		const message = issueText(issue, t);
		if (!issue.allowed?.length || field.widget === "icon") return message;
		return `${message} ${t("inspector.allowed").replace("{list}", issue.allowed.join(", "))}`;
	}

	function label(field: InspectorField): string {
		return field.required ? `${field.name} *` : field.name;
	}

	function onFocus(event: FocusEvent) {
		const pointer = (event.target as Element | null)?.closest("[data-pointer]")?.getAttribute("data-pointer");
		if (pointer) canvas.selectField(blockId, pointer, "inspector");
	}

	function valueOf(event: Event): string {
		return (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
	}
</script>

<Stack align="stretch" gap="4" data-slot="inspector-fields" onfocusin={onFocus}>
	{#each fields as field (field.pointer)}
		{@const id = fieldDomId(blockId, field.pointer)}
		{#if field.widget === "text" || field.widget === "longtext"}
			<Field label={label(field)} htmlFor={id} error={errorOf(field)}>
				{#if field.widget === "longtext"}
					<Textarea
						{id}
						size="sm"
						state={issues[field.pointer] ? "error" : undefined}
						value={text(field.value)}
						data-pointer={field.pointer}
						oninput={(event: Event) => handlers.onedit(field, valueOf(event), true)}
						onblur={() => handlers.onseal()}
					/>
				{:else}
					<Input
						{id}
						size="sm"
						state={issues[field.pointer] ? "error" : undefined}
						value={text(field.value)}
						data-pointer={field.pointer}
						oninput={(event: Event) => handlers.onedit(field, valueOf(event), true)}
						onblur={() => handlers.onseal()}
					/>
				{/if}
			</Field>
		{:else if field.widget === "icon"}
			{@const issue = issues[field.pointer]}
			<Field label={label(field)} htmlFor={id} hint={t("inspector.iconHint")} error={errorOf(field)}>
				<Input
					{id}
					size="sm"
					state={issue ? "error" : undefined}
					value={text(field.value)}
					autocomplete="off"
					spellcheck="false"
					data-pointer={field.pointer}
					onchange={(event: Event) => handlers.onedit(field, valueOf(event).trim(), false)}
				/>
				{#if issue?.allowed?.length}
					<Group class="flex-wrap gap-2" role="group" aria-label={t("inspector.closest")} data-slot="inspector-allowed">
						{#each closestAllowed(issue.value ?? "", issue.allowed) as name (name)}
							<Button size="sm" variant="outline" onclick={() => handlers.onedit(field, name, false)}>{name}</Button>
						{/each}
					</Group>
				{/if}
			</Field>
		{:else if field.widget === "enum"}
			<Field label={label(field)} htmlFor={id} error={errorOf(field)}>
				<Select
					{id}
					size="sm"
					value={text(field.value)}
					data-pointer={field.pointer}
					onchange={(event: Event) => handlers.onedit(field, (event.currentTarget as HTMLSelectElement).value, false)}
				>
					{#if field.value === undefined}
						<SelectOption value="">{t("inspector.unset")}</SelectOption>
					{/if}
					{#each field.options ?? [] as option (option)}
						<SelectOption value={option}>{option}</SelectOption>
					{/each}
				</Select>
			</Field>
		{:else if field.widget === "boolean"}
			<Group class="gap-2">
				<Checkbox
					{id}
					checked={field.value === true}
					data-pointer={field.pointer}
					onchange={(event: Event) => handlers.onedit(field, String((event.currentTarget as HTMLInputElement).checked), false)}
				/>
				<Label for={id}>{label(field)}</Label>
			</Group>
		{:else if field.widget === "number"}
			<Field label={label(field)} htmlFor={id} error={errorOf(field)}>
				<Input
					{id}
					size="sm"
					type="number"
					value={text(field.value)}
					data-pointer={field.pointer}
					onchange={(event: Event) => handlers.onedit(field, valueOf(event), false)}
				/>
			</Field>
		{:else if field.widget === "object"}
			<Fieldset variant="card" data-pointer={field.pointer}>
				<Legend class="text-xs">{label(field)}</Legend>
				<Self fields={field.fields ?? []} {blockId} {issues} {handlers} />
			</Fieldset>
		{:else if field.widget === "list"}
			{@const count = field.rows?.length ?? 0}
			{@const max = field.list?.max ?? 0}
			<Fieldset variant="card" data-pointer={field.pointer}>
				<Legend class="text-xs">{label(field)} · {t("inspector.rows").replace("{count}", String(count))}</Legend>
				{#if errorOf(field)}
					<Text tag="p" class="text-xs font-semibold text-destructive" role="alert">{errorOf(field)}</Text>
				{/if}
				{#if !count}
					<Text tag="p" class="text-xs text-muted-foreground">{t("inspector.noRows")}</Text>
				{/if}
				{#each field.rows ?? [] as row, index (row.pointer)}
					<Fieldset variant="card" data-pointer={row.pointer}>
						<Legend class="text-xs">{t("inspector.row").replace("{n}", String(index + 1))}</Legend>
						{#if handlers.onlist}
							<Group gap="2" justify="end" role="group" aria-label={t("inspector.rowActions").replace("{n}", String(index + 1))}>
								<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.rowUp")} title={t("inspector.rowUp")} disabled={index === 0} data-action="row-up" onclick={() => handlers.onlist!(field.pointer, "up", index)}>
									<ArrowUp />
								</Button>
								<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.rowDown")} title={t("inspector.rowDown")} disabled={index >= count - 1} data-action="row-down" onclick={() => handlers.onlist!(field.pointer, "down", index)}>
									<ArrowDown />
								</Button>
								<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.duplicateRow")} title={t("inspector.duplicateRow")} disabled={count >= max} data-action="duplicate-row" onclick={() => handlers.onlist!(field.pointer, "duplicate", index)}>
									<Copy />
								</Button>
								<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.removeRow")} title={t("inspector.removeRow")} data-action="remove-row" onclick={() => handlers.onlist!(field.pointer, "remove", index)}>
									<Trash2 />
								</Button>
							</Group>
						{/if}
						<Self fields={row.fields} {blockId} {issues} {handlers} />
					</Fieldset>
				{/each}
				{#if handlers.onlist}
					<Button size="sm" variant="outline" disabled={count >= max} data-action="add-row" onclick={() => handlers.onlist!(field.pointer, "add")}>
						<Plus />
						{t("inspector.addRow")}
					</Button>
				{/if}
			</Fieldset>
		{:else}
			<Field label={label(field)} htmlFor={id}>
				<Box {id} class="break-all text-xs text-muted-foreground" data-pointer={field.pointer}>{text(field.value) || t("inspector.unset")}</Box>
			</Field>
		{/if}
	{/each}
</Stack>

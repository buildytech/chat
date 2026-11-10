<!--
  Inspector fields of one level of a block's props (top level, an object prop or a list row), one registry widget per
  schema kind. A field is editable only with a page-spec origin and host handlers; every other field shows its value
  read-only. Rejected edits show the gate's message and, for an enum, the allowed values in the field. Focus in a field
  selects it on the canvas (ADR 0021): the overlay outlines where the preview shows it.
-->
<script lang="ts">
	import Copy from "@lucide/svelte/icons/copy";
	import Trash2 from "@lucide/svelte/icons/trash-2";
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
	import { closestAllowed, fieldDomId, type FieldHandlers, type FieldIssue } from "$lib/inspector/fields";
	import Self from "./InspectorFields.svelte";

	let {
		fields,
		blockId,
		variant,
		issues = {},
		handlers
	}: {
		fields: InspectorField[];
		blockId: string;
		variant: string;
		issues?: Record<string, FieldIssue>;
		/** Absent: every field is read-only. */
		handlers?: FieldHandlers;
	} = $props();

	function editable(field: InspectorField): boolean {
		return Boolean(handlers && field.origin);
	}

	function text(value: unknown): string {
		if (value === undefined || value === null) return "";
		return typeof value === "string" ? value : JSON.stringify(value);
	}

	function hint(field: InspectorField): string | undefined {
		if (field.origin) return undefined;
		return field.value === undefined ? t("inspector.unset") : t("inspector.fromVariant").replace("{variant}", variant);
	}

	function errorOf(field: InspectorField): string | undefined {
		const issue = issues[field.pointer];
		if (!issue) return undefined;
		if (!issue.allowed?.length || field.widget === "icon") return issue.message;
		return `${issue.message} ${t("inspector.allowed").replace("{list}", issue.allowed.join(", "))}`;
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
		{@const canEdit = editable(field)}
		{#if field.widget === "text" || field.widget === "longtext"}
			<Field label={label(field)} htmlFor={id} hint={hint(field)} error={errorOf(field)}>
				{#if field.widget === "longtext"}
					<Textarea
						{id}
						size="sm"
						state={issues[field.pointer] ? "error" : undefined}
						value={text(field.value)}
						readOnly={!canEdit}
						data-pointer={field.pointer}
						oninput={canEdit ? (event: Event) => handlers!.onedit(field, valueOf(event), true) : undefined}
						onblur={canEdit ? () => handlers!.onseal() : undefined}
					/>
				{:else}
					<Input
						{id}
						size="sm"
						state={issues[field.pointer] ? "error" : undefined}
						value={text(field.value)}
						readOnly={!canEdit}
						data-pointer={field.pointer}
						oninput={canEdit ? (event: Event) => handlers!.onedit(field, valueOf(event), true) : undefined}
						onblur={canEdit ? () => handlers!.onseal() : undefined}
					/>
				{/if}
			</Field>
		{:else if field.widget === "icon"}
			{@const issue = issues[field.pointer]}
			<Field label={label(field)} htmlFor={id} hint={hint(field) ?? t("inspector.iconHint")} error={errorOf(field)}>
				<Input
					{id}
					size="sm"
					state={issue ? "error" : undefined}
					value={text(field.value)}
					readOnly={!canEdit}
					autocomplete="off"
					spellcheck="false"
					data-pointer={field.pointer}
					onchange={canEdit ? (event: Event) => handlers!.onedit(field, valueOf(event).trim(), false) : undefined}
				/>
				{#if issue?.allowed?.length && canEdit}
					<Group class="flex-wrap gap-2" role="group" aria-label={t("inspector.closest")} data-slot="inspector-allowed">
						{#each closestAllowed(issue.value ?? "", issue.allowed) as name (name)}
							<Button size="sm" variant="outline" onclick={() => handlers!.onedit(field, name, false)}>{name}</Button>
						{/each}
					</Group>
				{/if}
			</Field>
		{:else if field.widget === "enum"}
			<Field label={label(field)} htmlFor={id} hint={hint(field)} error={errorOf(field)}>
				<Select {id} size="sm" value={text(field.value)} disabled data-pointer={field.pointer}>
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
				<Checkbox {id} checked={field.value === true} disabled data-pointer={field.pointer} />
				<Label for={id}>{label(field)}</Label>
				{#if hint(field)}
					<Text tag="span" class="text-xs text-muted-foreground">{hint(field)}</Text>
				{/if}
			</Group>
		{:else if field.widget === "number"}
			<Field label={label(field)} htmlFor={id} hint={hint(field)}>
				<Input {id} size="sm" type="number" value={text(field.value)} readOnly data-pointer={field.pointer} />
			</Field>
		{:else if field.widget === "object"}
			<Fieldset variant="card" data-pointer={field.pointer}>
				<Legend class="text-xs">{label(field)}</Legend>
				<Self fields={field.fields ?? []} {blockId} {variant} {issues} {handlers} />
			</Fieldset>
		{:else if field.widget === "list"}
			<Fieldset variant="card" data-pointer={field.pointer}>
				<Legend class="text-xs">{label(field)} · {t("inspector.rows").replace("{count}", String(field.rows?.length ?? 0))}</Legend>
				{#if !field.rows?.length}
					<Text tag="p" class="text-xs text-muted-foreground">{hint(field) ?? t("inspector.noRows")}</Text>
				{/if}
				{#each field.rows ?? [] as row, index (row.pointer)}
					<Fieldset variant="card" data-pointer={row.pointer}>
						<Legend class="text-xs">{t("inspector.row").replace("{n}", String(index + 1))}</Legend>
						{#if handlers?.onrow && row.origin}
							<Group gap="2" justify="end" role="group" aria-label={t("inspector.rowActions").replace("{n}", String(index + 1))}>
								<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.duplicateRow")} title={t("inspector.duplicateRow")} data-action="duplicate-row" onclick={() => handlers!.onrow!(index, "duplicate")}>
									<Copy />
								</Button>
								<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.removeRow")} title={t("inspector.removeRow")} data-action="remove-row" onclick={() => handlers!.onrow!(index, "remove")}>
									<Trash2 />
								</Button>
							</Group>
						{/if}
						<Self fields={row.fields} {blockId} {variant} {issues} {handlers} />
					</Fieldset>
				{/each}
			</Fieldset>
		{:else}
			<Field label={label(field)} htmlFor={id} hint={hint(field)}>
				<Box {id} class="break-all text-xs text-muted-foreground" data-pointer={field.pointer}>{text(field.value) || t("inspector.unset")}</Box>
			</Field>
		{/if}
	{/each}
</Stack>

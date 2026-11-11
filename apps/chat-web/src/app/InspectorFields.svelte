<!--
  Inspector fields of one level of a block's props (top level, an object prop or a list row), one registry widget per
  schema kind. A field is editable only with a page-spec origin and host handlers; every other field shows its value
  locked (muted, lock icon, not-allowed cursor, aria-readonly) with the real reason: a variant axis (its select
  switches to the named variant of that value, or says to choose in Variant above), a sample placeholder of the
  schema, or no page field yet. Rejected edits show the gate's message and, for an enum, the allowed values in the field. Focus in a field
  selects it on the canvas (ADR 0021): the overlay outlines where the preview shows it.
-->
<script lang="ts">
	import Copy from "@lucide/svelte/icons/copy";
	import Lock from "@lucide/svelte/icons/lock";
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
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import type { InspectorField } from "@buildytech/builder-core";
	import { t } from "$lib/i18n/dictionary";
	import { canvas } from "$lib/inspector/canvas.svelte";
	import { axisSwitch, closestAllowed, fieldDomId, issueText, lockHint, LOCKED_CONTROL, type FieldHandlers, type FieldIssue } from "$lib/inspector/fields";
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
		const key = lockHint(field);
		return key ? t(key).replace("{variant}", variant) : undefined;
	}

	function errorOf(field: InspectorField): string | undefined {
		const issue = issues[field.pointer];
		if (!issue) return undefined;
		const message = issueText(issue, t);
		if (!issue.allowed?.length || field.widget === "icon") return message;
		return `${message} ${t("inspector.allowed").replace("{list}", issue.allowed.join(", "))}`;
	}

	function onAxis(field: InspectorField, event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		const target = field.choices?.find((choice) => choice.value === value)?.variant;
		if (target && target !== variant) handlers?.onvariant?.(target);
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

{#snippet lockMark()}
	<Group gap="2" class="text-xs text-muted-foreground" data-slot="inspector-lock">
		<Icon size="sm"><Lock /></Icon>
		<Text tag="span" class="text-xs">{t("inspector.locked")}</Text>
	</Group>
{/snippet}

<Stack align="stretch" gap="4" data-slot="inspector-fields" onfocusin={onFocus}>
	{#each fields as field (field.pointer)}
		{@const id = fieldDomId(blockId, field.pointer)}
		{@const canEdit = editable(field)}
		{#if field.widget === "text" || field.widget === "longtext"}
			<Field label={label(field)} htmlFor={id} hint={hint(field)} error={errorOf(field)}>
				{#if !canEdit}{@render lockMark()}{/if}
				{#if field.widget === "longtext"}
					<Textarea
						{id}
						size="sm"
						class={canEdit ? undefined : LOCKED_CONTROL}
						state={issues[field.pointer] ? "error" : undefined}
						value={text(field.value)}
						readOnly={!canEdit}
						aria-readonly={canEdit ? undefined : "true"}
						title={canEdit ? undefined : hint(field)}
						data-locked={canEdit ? undefined : field.lock ?? "readonly"}
						data-pointer={field.pointer}
						oninput={canEdit ? (event: Event) => handlers!.onedit(field, valueOf(event), true) : undefined}
						onblur={canEdit ? () => handlers!.onseal() : undefined}
					/>
				{:else}
					<Input
						{id}
						size="sm"
						class={canEdit ? undefined : LOCKED_CONTROL}
						state={issues[field.pointer] ? "error" : undefined}
						value={text(field.value)}
						readOnly={!canEdit}
						aria-readonly={canEdit ? undefined : "true"}
						title={canEdit ? undefined : hint(field)}
						data-locked={canEdit ? undefined : field.lock ?? "readonly"}
						data-pointer={field.pointer}
						oninput={canEdit ? (event: Event) => handlers!.onedit(field, valueOf(event), true) : undefined}
						onblur={canEdit ? () => handlers!.onseal() : undefined}
					/>
				{/if}
			</Field>
		{:else if field.widget === "icon"}
			{@const issue = issues[field.pointer]}
			<Field label={label(field)} htmlFor={id} hint={hint(field) ?? t("inspector.iconHint")} error={errorOf(field)}>
				{#if !canEdit}{@render lockMark()}{/if}
				<Input
					{id}
					size="sm"
					class={canEdit ? undefined : LOCKED_CONTROL}
					state={issue ? "error" : undefined}
					value={text(field.value)}
					readOnly={!canEdit}
					aria-readonly={canEdit ? undefined : "true"}
					title={canEdit ? undefined : hint(field)}
					data-locked={canEdit ? undefined : field.lock ?? "readonly"}
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
			{@const axis = axisSwitch(field, Boolean(handlers?.onvariant))}
			<Field label={label(field)} htmlFor={id} hint={hint(field)} error={errorOf(field)}>
				{#if !axis}{@render lockMark()}{/if}
				<Select
					{id}
					size="sm"
					value={text(field.value)}
					disabled={!axis}
					title={hint(field)}
					data-locked={axis ? undefined : field.lock ?? "readonly"}
					data-action={axis ? "axis-variant" : undefined}
					data-pointer={field.pointer}
					onchange={axis ? (event: Event) => onAxis(field, event) : undefined}
				>
					{#if field.value === undefined}
						<SelectOption value="">{t("inspector.unset")}</SelectOption>
					{/if}
					{#each field.options ?? [] as option (option)}
						{@const choice = field.choices?.find((entry) => entry.value === option)}
						<SelectOption value={option} disabled={axis && option !== text(field.value) && !choice?.variant}>{option}{choice?.variant && option !== text(field.value) ? ` · ${choice.variant}` : ""}</SelectOption>
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
				{@render lockMark()}
				<Input {id} size="sm" type="number" class={LOCKED_CONTROL} value={text(field.value)} readOnly aria-readonly="true" title={hint(field)} data-locked={field.lock ?? "readonly"} data-pointer={field.pointer} />
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

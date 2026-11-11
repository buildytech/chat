<!--
  Inspector fields of one level of a block's props (top level, an object prop or a list row), one registry widget per
  schema kind. A field is editable with host handlers when a page-spec copy slot maps it (origin) or, otherwise, as a
  block props override (page-spec 1.3.0, `prop`), validated against the item's props schema. A field that is neither
  renders locked (muted, lock icon, not-allowed cursor, aria-readonly) with the real reason. A variant axis select
  switches to the named variant of the picked combination, else overrides the axis. Lists add, remove and reorder
  rows (page rows or a props list). Rejected edits show the gate's message and, for an enum, the allowed values. Focus
  in a field selects it on the canvas (ADR 0021): the overlay outlines where the preview shows it.
-->
<script lang="ts">
	import ArrowDown from "@lucide/svelte/icons/arrow-down";
	import ArrowUp from "@lucide/svelte/icons/arrow-up";
	import Copy from "@lucide/svelte/icons/copy";
	import Lock from "@lucide/svelte/icons/lock";
	import Plus from "@lucide/svelte/icons/plus";
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
	import { axisAction, axisSwitch, closestAllowed, fieldDomId, issueText, lockHint, LOCKED_CONTROL, type FieldHandlers, type FieldIssue } from "$lib/inspector/fields";
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
		return Boolean(handlers && (field.origin || field.prop));
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

	function onEnum(field: InspectorField, event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		if (field.choices) {
			const action = axisAction(field, value, variant);
			if (action && "variant" in action) handlers?.onvariant?.(action.variant);
			else if (action) handlers?.onedit(field, action.override, false);
			return;
		}
		handlers?.onedit(field, value, false);
	}

	function rowActions(field: InspectorField): boolean {
		return Boolean(handlers?.onlist && field.list);
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
						data-write={canEdit ? (field.origin ? "copy" : "props") : undefined}
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
						data-write={canEdit ? (field.origin ? "copy" : "props") : undefined}
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
					data-write={canEdit ? (field.origin ? "copy" : "props") : undefined}
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
			{@const live = field.choices ? axisSwitch(field, Boolean(handlers?.onvariant)) : canEdit}
			<Field label={label(field)} htmlFor={id} hint={hint(field)} error={errorOf(field)}>
				{#if !live}{@render lockMark()}{/if}
				<Select
					{id}
					size="sm"
					value={text(field.value)}
					disabled={!live}
					title={hint(field)}
					data-locked={live ? undefined : field.lock ?? "readonly"}
					data-action={live && field.choices ? "axis-variant" : undefined}
					data-write={live ? (field.choices ? "axis" : "props") : undefined}
					data-pointer={field.pointer}
					onchange={live ? (event: Event) => onEnum(field, event) : undefined}
				>
					{#if field.value === undefined}
						<SelectOption value="">{t("inspector.unset")}</SelectOption>
					{/if}
					{#each field.options ?? [] as option (option)}
						{@const choice = field.choices?.find((entry) => entry.value === option)}
						<SelectOption value={option} disabled={Boolean(field.choices) && !field.prop && option !== text(field.value) && !choice?.variant}>{option}{choice?.variant && choice.variant !== variant ? ` · ${choice.variant}` : ""}</SelectOption>
					{/each}
				</Select>
			</Field>
		{:else if field.widget === "boolean"}
			<Group class="gap-2">
				<Checkbox
					{id}
					checked={field.value === true}
					disabled={!canEdit}
					data-write={canEdit ? "props" : undefined}
					data-pointer={field.pointer}
					onchange={canEdit ? (event: Event) => handlers!.onedit(field, String((event.currentTarget as HTMLInputElement).checked), false) : undefined}
				/>
				<Label for={id}>{label(field)}</Label>
				{#if hint(field)}
					<Text tag="span" class="text-xs text-muted-foreground">{hint(field)}</Text>
				{/if}
			</Group>
		{:else if field.widget === "number"}
			<Field label={label(field)} htmlFor={id} hint={hint(field)} error={errorOf(field)}>
				{#if !canEdit}{@render lockMark()}{/if}
				<Input
					{id}
					size="sm"
					type="number"
					class={canEdit ? undefined : LOCKED_CONTROL}
					value={text(field.value)}
					readOnly={!canEdit}
					aria-readonly={canEdit ? undefined : "true"}
					title={canEdit ? undefined : hint(field)}
					data-locked={canEdit ? undefined : field.lock ?? "readonly"}
					data-write={canEdit ? "props" : undefined}
					data-pointer={field.pointer}
					onchange={canEdit ? (event: Event) => handlers!.onedit(field, valueOf(event), false) : undefined}
				/>
			</Field>
		{:else if field.widget === "object"}
			<Fieldset variant="card" data-pointer={field.pointer}>
				<Legend class="text-xs">{label(field)}</Legend>
				<Self fields={field.fields ?? []} {blockId} {variant} {issues} {handlers} />
			</Fieldset>
		{:else if field.widget === "list"}
			{@const count = field.rows?.length ?? 0}
			<Fieldset variant="card" data-pointer={field.pointer} data-list={field.list?.source}>
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
						{#if rowActions(field)}
							<Group gap="2" justify="end" role="group" aria-label={t("inspector.rowActions").replace("{n}", String(index + 1))}>
								<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.rowUp")} title={t("inspector.rowUp")} disabled={index === 0} data-action="row-up" onclick={() => handlers!.onlist!(field.pointer, "up", index)}>
									<ArrowUp />
								</Button>
								<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.rowDown")} title={t("inspector.rowDown")} disabled={index >= count - 1} data-action="row-down" onclick={() => handlers!.onlist!(field.pointer, "down", index)}>
									<ArrowDown />
								</Button>
								{#if handlers?.onrow && row.origin}
									<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.duplicateRow")} title={t("inspector.duplicateRow")} disabled={count >= (field.list?.max ?? 0)} data-action="duplicate-row" onclick={() => handlers!.onrow!(index, "duplicate")}>
										<Copy />
									</Button>
								{/if}
								<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.removeRow")} title={t("inspector.removeRow")} data-action="remove-row" onclick={() => handlers!.onlist!(field.pointer, "remove", index)}>
									<Trash2 />
								</Button>
							</Group>
						{/if}
						<Self fields={row.fields} {blockId} {variant} {issues} {handlers} />
					</Fieldset>
				{/each}
				{#if rowActions(field)}
					<Button size="sm" variant="outline" disabled={count >= (field.list?.max ?? 0)} data-action="add-row" onclick={() => handlers!.onlist!(field.pointer, "add")}>
						<Plus />
						{t("inspector.addRow")}
					</Button>
				{/if}
			</Fieldset>
		{:else}
			<Field label={label(field)} htmlFor={id} hint={hint(field)}>
				<Box {id} class="break-all text-xs text-muted-foreground" data-pointer={field.pointer}>{text(field.value) || t("inspector.unset")}</Box>
			</Field>
		{/if}
	{/each}
</Stack>

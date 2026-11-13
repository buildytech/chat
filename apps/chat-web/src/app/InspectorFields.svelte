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
	import { mapKeyIssue, type InspectorField } from "@buildytech/builder-core";
	import { t } from "$lib/i18n/dictionary";
	import { canvas } from "$lib/inspector/canvas.svelte";
	import { closestAllowed, fieldDomId, hasContent, issueText, type FieldHandlers, type FieldIssue } from "$lib/inspector/fields";
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

	/** Entry keys that were refused, by entry pointer (the text stays in the field until it is fixed). */
	let keyErrors = $state<Record<string, string>>({});

	/** Rename a map key: checked here for the message beside the field, and again by the operation. */
	function renameKey(field: InspectorField, key: string, pointer: string, to: string) {
		if (to === key) {
			delete keyErrors[pointer];
			return;
		}
		const others = (field.entries ?? []).map((entry) => entry.key).filter((name) => name !== key);
		const bad = mapKeyIssue(to, others, field.keyPattern);
		if (bad) {
			keyErrors[pointer] = t(`inspector.key.${bad}`);
			return;
		}
		delete keyErrors[pointer];
		handlers.onmap?.(field.pointer, "rename", key, to);
	}

	function onFocus(event: FocusEvent) {
		const pointer = (event.target as Element | null)?.closest("[data-pointer]")?.getAttribute("data-pointer");
		if (pointer) canvas.selectField(blockId, pointer, "inspector");
	}

	function valueOf(event: Event): string {
		return (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
	}
</script>

{#snippet entryInput(item: InspectorField, itemId: string)}
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
			class="min-w-0 flex-1"
			aria-label={item.name}
			state={issues[item.pointer] ? "error" : undefined}
			value={text(item.value)}
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
{/snippet}

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
				<Legend class="text-xs">{label(field)}{#if !field.required && !hasContent(field)} · {t("inspector.unset")}{/if}</Legend>
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
		{:else if field.widget === "values"}
			{@const count = field.items?.length ?? 0}
			{@const max = field.list?.max ?? 0}
			<Fieldset variant="card" data-pointer={field.pointer}>
				<Legend class="text-xs">{label(field)} · {t("inspector.items").replace("{count}", String(count))}</Legend>
				{#if errorOf(field)}
					<Text tag="p" class="text-xs font-semibold text-destructive" role="alert">{errorOf(field)}</Text>
				{/if}
				{#if !count}
					<Text tag="p" class="text-xs text-muted-foreground">{t("inspector.noItems")}</Text>
				{/if}
				{#each field.items ?? [] as item, index (item.pointer)}
					{@const itemId = fieldDomId(blockId, item.pointer)}
					<Group gap="2" align="center" data-pointer={item.pointer} data-slot="inspector-item">
						{@render entryInput(item, itemId)}
						{#if handlers.onlist}
							<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.itemUp").replace("{n}", String(index + 1))} title={t("inspector.itemUp").replace("{n}", String(index + 1))} disabled={index === 0} data-action="item-up" onclick={() => handlers.onlist!(field.pointer, "up", index)}>
								<ArrowUp />
							</Button>
							<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.itemDown").replace("{n}", String(index + 1))} title={t("inspector.itemDown").replace("{n}", String(index + 1))} disabled={index >= count - 1} data-action="item-down" onclick={() => handlers.onlist!(field.pointer, "down", index)}>
								<ArrowDown />
							</Button>
							<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.removeItem").replace("{n}", String(index + 1))} title={t("inspector.removeItem").replace("{n}", String(index + 1))} disabled={count <= (field.list?.min ?? 0) && !(count === 1 && !field.required)} data-action="remove-item" onclick={() => handlers.onlist!(field.pointer, "remove", index)}>
								<Trash2 />
							</Button>
						{/if}
					</Group>
					{#if issues[item.pointer]}
						<Text tag="p" class="text-xs font-semibold text-destructive" role="alert">{errorOf(item)}</Text>
					{/if}
				{/each}
				{#if handlers.onlist}
					<Button size="sm" variant="outline" disabled={count >= max} data-action="add-item" onclick={() => handlers.onlist!(field.pointer, "add")}>
						<Plus />
						{t("inspector.addItem")}
					</Button>
				{/if}
			</Fieldset>
		{:else if field.widget === "map"}
			{@const count = field.entries?.length ?? 0}
			{@const max = field.list?.max ?? 0}
			<Fieldset variant="card" data-pointer={field.pointer}>
				<Legend class="text-xs">{label(field)} · {t("inspector.entries").replace("{count}", String(count))}</Legend>
				{#if errorOf(field)}
					<Text tag="p" class="text-xs font-semibold text-destructive" role="alert">{errorOf(field)}</Text>
				{/if}
				{#if !count}
					<Text tag="p" class="text-xs text-muted-foreground">{t("inspector.noEntries")}</Text>
				{/if}
				{#each field.entries ?? [] as entry (entry.field.pointer)}
					{@const keyId = `${fieldDomId(blockId, entry.field.pointer)}-key`}
					<Stack gap="2" data-pointer={entry.field.pointer} data-slot="inspector-entry">
						<Group gap="2" align="center">
							<Input
								id={keyId}
								size="sm"
								class="min-w-0 flex-1"
								aria-label={t("inspector.entryKey")}
								state={keyErrors[entry.field.pointer] ? "error" : undefined}
								value={entry.key}
								autocomplete="off"
								spellcheck="false"
								onchange={(event: Event) => renameKey(field, entry.key, entry.field.pointer, valueOf(event))}
							/>
							{#if handlers.onmap}
								<Button size="sm" layout="icon" variant="ghost" aria-label={t("inspector.removeEntry").replace("{key}", entry.key)} title={t("inspector.removeEntry").replace("{key}", entry.key)} disabled={count <= (field.list?.min ?? 0) && !(count === 1 && !field.required)} data-action="remove-entry" onclick={() => handlers.onmap!(field.pointer, "remove", entry.key)}>
									<Trash2 />
								</Button>
							{/if}
						</Group>
						{#if keyErrors[entry.field.pointer]}
							<Text tag="p" class="text-xs font-semibold text-destructive" role="alert">{keyErrors[entry.field.pointer]}</Text>
						{/if}
						<Group gap="2" align="center">
							{@render entryInput(entry.field, fieldDomId(blockId, entry.field.pointer))}
						</Group>
						{#if issues[entry.field.pointer]}
							<Text tag="p" class="text-xs font-semibold text-destructive" role="alert">{errorOf(entry.field)}</Text>
						{/if}
					</Stack>
				{/each}
				{#if handlers.onmap}
					<Button size="sm" variant="outline" disabled={count >= max} data-action="add-entry" onclick={() => handlers.onmap!(field.pointer, "add")}>
						<Plus />
						{t("inspector.addEntry")}
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

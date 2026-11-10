<script lang="ts">
	import Block from "$registry/compose/Block.svelte";
	import Checkbox from "$registry/compose/Checkbox.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Label from "$registry/compose/Label.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Title from "$registry/compose/Title.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { planOpText } from "$lib/chat-core/change-text";
	import type { PagePlan } from "@buildytech/builder-core";

	// An Ask page plan (ADR 0020): the ops were checked by the program; only valid ops can be ticked. Apply in Build runs
	// the ticked ops without a model call and makes one proposal the author applies.
	let { plan, messageId, onApply }: { plan: PagePlan; messageId: string; onApply?: (selected: string[]) => void } = $props();

	const ran = $derived(plan.status !== "proposed");
	const validIds = $derived(plan.ops.filter((op) => op.valid).map((op) => op.id));
	let unticked = $state<string[]>([]);
	const selected = $derived(validIds.filter((id) => !unticked.includes(id)));
	const headingId = $derived(`ask-plan-${messageId}`);

	function toggle(id: string, on: boolean) {
		unticked = on ? unticked.filter((row) => row !== id) : [...unticked, id];
	}
</script>

<Block tag="section" class="rounded border border-border p-2" data-slot="ask-plan" data-status={plan.status} aria-labelledby={headingId}>
	<Stack align="stretch" class="gap-2">
		<Group class="flex-wrap items-center justify-between gap-2">
			<Title as={3} id={headingId} class="text-xs font-semibold text-foreground">{t("plan.title")}</Title>
			<Text tag="span" class="text-xs text-muted-foreground" data-slot="ask-plan-status">
				{t(`plan.status.${plan.status}`)} · {t("plan.summary").replace("{n}", String(plan.ops.length)).replace("{valid}", String(validIds.length))}
			</Text>
		</Group>
		{#if plan.summary}
			<Text tag="p" class="text-xs text-muted-foreground">{plan.summary}</Text>
		{/if}
		<Box tag="ul" class="flex flex-col gap-2" data-slot="ask-plan-ops">
			{#each plan.ops as op (op.id)}
				<Box tag="li" data-slot="ask-plan-op" data-op={op.op} data-valid={op.valid ? "true" : "false"}>
					<Group class="items-start gap-2">
						<Checkbox
							id={`${headingId}-${op.id}`}
							checked={op.valid && !ran ? selected.includes(op.id) : op.result?.status === "applied"}
							disabled={!op.valid || ran}
							aria-describedby={op.issue ? `${headingId}-${op.id}-issue` : undefined}
							onchange={(event: Event) => toggle(op.id, (event.currentTarget as HTMLInputElement).checked)}
						/>
						<Stack align="stretch" class="min-w-0 flex-1 gap-0">
							<Label for={`${headingId}-${op.id}`} class="text-xs text-foreground break-words">{planOpText(op, t)}</Label>
							{#if op.reason}
								<Text tag="p" class="text-xs text-muted-foreground">{op.reason}</Text>
							{/if}
							{#if op.issue}
								<Text tag="p" id={`${headingId}-${op.id}-issue`} class="text-xs text-destructive" data-slot="ask-plan-issue">
									{t("plan.invalid").replace("{message}", op.issue.message)}{op.issue.allowed?.length
										? ` ${t("plan.allowed").replace("{list}", op.issue.allowed.join(", "))}`
										: ""}
								</Text>
							{/if}
							{#if op.result}
								<Text tag="p" class="text-xs text-muted-foreground" data-slot="ask-plan-result" data-result={op.result.status}>
									{t(`plan.result.${op.result.status}`)}{op.result.code ? ` (${op.result.code})` : ""}
								</Text>
							{/if}
						</Stack>
					</Group>
				</Box>
			{/each}
		</Box>
		{#if !ran && validIds.length > 0}
			<Text tag="p" class="text-xs text-muted-foreground">{t("plan.applyHint")}</Text>
			<Group class="items-center gap-2">
				<Button
					class="rounded bg-foreground px-2 py-1 text-xs text-background hover:bg-foreground/90 disabled:opacity-50"
					disabled={selected.length === 0}
					data-slot="ask-plan-apply"
					onclick={() => onApply?.(selected)}
				>
					<Text tag="span">{t("plan.applyInBuild")}</Text>
				</Button>
				{#if selected.length === 0}
					<Text tag="span" class="text-xs text-muted-foreground" role="status">{t("plan.nothingSelected")}</Text>
				{/if}
			</Group>
		{/if}
	</Stack>
</Block>

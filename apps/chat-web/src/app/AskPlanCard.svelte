<script lang="ts">
	import { onMount } from "svelte";
 import { loadPropsGate } from "$lib/chat-core";
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
	import Select from "$registry/compose/Select.svelte";
 import SelectOption from "$registry/compose/SelectOption.svelte";
 import { getPlanRepairs, repairPlanField } from "$lib/chat-core/session.svelte";
 import { isPlanNoop, planHasInvalid, type PagePlan } from "@buildytech/builder-core";

	// An Ask page plan (ADR 0020): the ops were checked by the program; only valid ops can be ticked. Apply in Build runs
	// the ticked ops without a model call and makes one proposal the author applies. An op that would change nothing
	// (same variant, same value) is a "keep" row: unticked, muted, never an error.
	let { plan, messageId, onApply }: { plan: PagePlan; messageId: string; onApply?: (selected: string[]) => void } = $props();

	let repairReady = $state(false);
 let repairError = $state(false);
 onMount(() => { void loadPropsGate().then(()=>repairReady=true).catch(()=>repairError=true); });
 const repairs = $derived(repairReady ? getPlanRepairs(messageId) : []);
 const needsRepair = $derived(planHasInvalid(plan));
 const ran = $derived(plan.status !== "proposed");
	const validIds = $derived(plan.ops.filter((op) => op.valid).map((op) => op.id));
	let unticked = $state<string[]>([]);
	const selected = $derived(validIds.filter((id) => !unticked.includes(id)));
	const keepCount = $derived(plan.ops.filter((op) => isPlanNoop(op)).length);
	const summary = $derived(
		t(keepCount ? "plan.summaryKeep" : "plan.summary")
			.replace("{n}", String(plan.ops.length - keepCount))
			.replace("{valid}", String(validIds.length))
			.replace("{keep}", String(keepCount))
	);
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
				{t(needsRepair && !ran ? "plan.needsRepair" : !ran && validIds.length === 0 ? "plan.unchanged" : `plan.status.${plan.status}`)} · {summary}
			</Text>
		</Group>
		{#if repairError}<Text tag="p" role="alert" class="text-xs text-destructive">{t("plan.repairUnavailable")}</Text>{/if}
 {#if plan.summary}
			<Text tag="p" class="text-xs text-muted-foreground">{plan.summary}</Text>
		{/if}
		<Box tag="ul" class="flex flex-col gap-2" data-slot="ask-plan-ops">
			{#each plan.ops as op (op.id)}
				{@const keep = isPlanNoop(op)}
				<Box tag="li" data-slot="ask-plan-op" data-op={op.op} data-valid={op.valid ? "true" : "false"} data-noop={keep ? "true" : undefined}>
					<Group class="items-start gap-2">
						<Checkbox
							id={`${headingId}-${op.id}`}
							checked={op.valid && !ran ? selected.includes(op.id) : op.result?.status === "applied"}
							disabled={!op.valid || ran}
							aria-describedby={op.issue || keep ? `${headingId}-${op.id}-issue` : undefined}
							onchange={(event: Event) => toggle(op.id, (event.currentTarget as HTMLInputElement).checked)}
						/>
						<Stack align="stretch" class="min-w-0 flex-1 gap-0">
							<Label for={`${headingId}-${op.id}`} class={keep ? "text-xs text-muted-foreground break-words" : "text-xs text-foreground break-words"}>{planOpText(op, t)}</Label>
							{#if op.reason}
								<Text tag="p" class="text-xs text-muted-foreground">{op.reason}</Text>
							{/if}
							{#if op.dropped?.length && !keep && !op.issue}
								<Text tag="p" class="text-xs text-muted-foreground" data-slot="ask-plan-dropped">{t("plan.dropped").replace("{list}", op.dropped.join(", "))}</Text>
							{/if}
							{#if keep}
								<Text tag="p" id={`${headingId}-${op.id}-issue`} class="text-xs text-muted-foreground" data-slot="ask-plan-keep">{t("plan.keep")}</Text>
							{:else if op.issue}
								<Text tag="p" id={`${headingId}-${op.id}-issue`} class="text-xs text-destructive" data-slot="ask-plan-issue">
									{t("plan.invalid").replace("{message}", op.issue.message)}{op.issue.allowed?.length
										? ` ${t("plan.allowed").replace("{list}", op.issue.allowed.join(", "))}`
										: ""}
								</Text>
							{/if}
							{#if !ran}
 {#each repairs.filter(repair=>repair.opId===op.id) as repair (repair.field)}
 <Text tag="p" class="text-xs text-muted-foreground">{repair.label}: {repair.value}</Text>
 <Select aria-label={t('plan.fixField').replace('{field}',repair.label)} value="" class="h-8 w-full text-xs" onchange={(event: Event)=>repairPlanField(messageId,op.id,repair.field,(event.currentTarget as HTMLSelectElement).value)}>
 <SelectOption value="" disabled>{t('plan.chooseAllowed')}</SelectOption>
 {#each repair.allowed as value}<SelectOption {value}>{value}</SelectOption>{/each}
 </Select>
 {/each}
 {/if}
 {#if op.result && !keep}
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
					<Text tag="span">{t("plan.applySelected").replace("{n}", String(selected.length))}</Text>
				</Button>
				{#if selected.length === 0}
					<Text tag="span" class="text-xs text-muted-foreground" role="status">{t("plan.nothingSelected")}</Text>
				{/if}
			</Group>
		{/if}
	</Stack>
</Block>

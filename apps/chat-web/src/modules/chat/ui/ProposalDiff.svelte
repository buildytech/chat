<!--
  A proposal as a per-block diff against the page the author sees (ADR 0034): added, removed, moved and changed blocks
  and page fields, one row each, with its status. Build proposals are applied or discarded here; Ask is read-only and has
  no actions (an Ask proposal of an older chat shows its rows only). The rows come from the diff, never from model text.
-->
<script lang="ts">
	import { ArrowUp, Pencil, Plus, Trash2 } from "$lib/shell-icons";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { diffRows } from "$modules/chat/core/change-text";
	import { applyProposal, discardProposal, isPendingProposal, proposalStatus, type ChatMessage } from "$modules/chat/core";

	let { message, onApply, onDiscard }: { message: ChatMessage; onApply?: () => void; onDiscard?: () => void } = $props();

	const proposal = $derived(message.proposal);
	const rows = $derived(proposal?.diff ? diffRows(proposal.diff, t) : []);
	const status = $derived(proposal ? proposalStatus(proposal) : null);
	const pending = $derived(proposal ? isPendingProposal(proposal) : false);
	const ask = $derived(message.mode === "ask");

	const statusLabel = $derived(
		status === "applied"
			? t("proposal.applied")
			: status === "discarded"
				? t("proposal.discarded")
				: status === "superseded"
					? t("proposal.superseded")
					: t("proposal.notApplied"),
	);
</script>

{#if proposal}
	<Stack align="stretch" class="gap-2" data-slot="proposal" data-status={status} data-origin={proposal.origin ?? "build"}>
		{#if rows.length}
			<Box tag="ul" class="flex flex-col gap-1 rounded border border-border p-2" aria-label={t("diff.title")} data-slot="proposal-diff">
				{#each rows as row, index (`${row.kind}-${row.id ?? ""}-${index}`)}
					<Box tag="li" class="flex items-start gap-2" data-diff={row.kind}>
						<Icon size="sm" class="shrink-0 text-muted-foreground">
							{#if row.kind === "removed"}<Trash2 />{:else if row.kind === "added"}<Plus />{:else if row.kind === "moved"}<ArrowUp />{:else}<Pencil />{/if}
						</Icon>
						<Text tag="span" class="min-w-0 break-words text-xs text-foreground">{row.text}</Text>
					</Box>
				{/each}
			</Box>
		{/if}
		<Group class="flex-wrap items-center gap-2">
			<Text tag="span" class="text-xs text-muted-foreground">{statusLabel}</Text>
			{#if pending && !ask}
				<Button class="rounded bg-foreground px-3 py-1 text-sm text-background hover:bg-foreground/90" data-action="apply" onclick={() => (onApply ? onApply() : applyProposal())}>
					<Text tag="span">{t("proposal.apply")}</Text>
				</Button>
				<Button class="rounded border border-border px-3 py-1 text-sm text-foreground hover:bg-accent" data-action="discard" onclick={() => (onDiscard ? onDiscard() : discardProposal())}>
					<Text tag="span">{t("proposal.discard")}</Text>
				</Button>
			{/if}
		</Group>
	</Stack>
{/if}

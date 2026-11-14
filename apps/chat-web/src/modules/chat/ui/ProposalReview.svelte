<script lang="ts">
	// Slot preview.review: the pending proposal's Apply / Discard, or the line that the last one was applied.
	import Group from "$registry/compose/Group.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { hasUnappliedProposal } from "$lib/page-store";
	import { previewSettings } from "$lib/browser/preview-settings.svelte";
	import { applyProposal, discardProposal, getSelectedSession, proposalStatus } from "../core";

	const unapplied = $derived(hasUnappliedProposal());
	const clean = $derived(previewSettings.hideServiceLabels);
	const appliedLabel = $derived.by(() => {
		const last = getSelectedSession()
			?.messages.slice()
			.reverse()
			.find((message) => message.proposal);
		return last?.proposal && proposalStatus(last.proposal) === "applied" && !unapplied ? t("proposal.applied") : "";
	});
</script>

{#if unapplied}
	<Group class="items-center justify-between gap-2 rounded border border-border bg-muted px-2 py-2">
		<Text tag="span" class="text-xs text-muted-foreground">{t("proposal.notApplied")}</Text>
		<Group class="gap-2">
			<Button class="rounded bg-foreground px-3 py-2 text-sm text-background hover:bg-foreground/90" onclick={() => applyProposal()}>
				<Text tag="span">{t("proposal.apply")}</Text>
			</Button>
			<Button class="rounded border border-border px-3 py-2 text-sm text-foreground hover:bg-accent" onclick={() => discardProposal()}>
				<Text tag="span">{t("proposal.discard")}</Text>
			</Button>
		</Group>
	</Group>
{:else if appliedLabel && !clean}
	<Group class="items-center justify-between gap-2 rounded border border-border bg-muted px-2 py-2">
		<Text tag="span" class="text-xs text-muted-foreground">{appliedLabel}</Text>
	</Group>
{/if}

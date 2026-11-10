<script lang="ts">
	import Copy from "@lucide/svelte/icons/copy";
	import FileText from "@lucide/svelte/icons/file-text";
	import Pencil from "@lucide/svelte/icons/pencil";
	import Share2 from "@lucide/svelte/icons/share-2";
	import ThumbsDown from "@lucide/svelte/icons/thumbs-down";
	import ThumbsUp from "@lucide/svelte/icons/thumbs-up";
	import Block from "$registry/compose/Block.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import type { ChatMessage as ChatMessageModel } from "$lib/chat-core";
	import { isPendingProposal, proposalStatus } from "$lib/chat-core/proposals";
	import { formatTokens } from "@buildytech/builder-core";
	import CatalogRefsList from "./CatalogRefsList.svelte";
	import MarkdownText from "./MarkdownText.svelte";
	import AskBlockCards from "./AskBlockCards.svelte";
	import AskPlanCard from "./AskPlanCard.svelte";
	import { applyPlanInBuild, applyProposal, applyVariantFromAsk, discardProposal } from "$lib/chat-core";

	let {
		message,
		activity = [],
		showActivity = false,
		onEdit,
		onApply,
		onDiscard
	}: {
		message: ChatMessageModel;
		activity?: string[];
		showActivity?: boolean;
		onEdit?: (text: string) => void;
		onApply?: () => void;
		onDiscard?: () => void;
	} = $props();

	const run = $derived(message.run);
	const proposal = $derived(message.proposal);
	const status = $derived(proposal ? proposalStatus(proposal) : null);
	const pending = $derived(proposal ? isPendingProposal(proposal) : false);
	// Proposal replies are written from what the proposal changes (ADR 0020); the status line shows its state.
	const body = $derived(message.text);
	const statusLabel = $derived(
		status === "applied"
			? t("proposal.applied")
			: status === "discarded"
				? t("proposal.discarded")
				: status === "superseded"
					? t("proposal.superseded")
					: t("proposal.notApplied")
	);

	const mine = $derived(message.role === "user");
	const youMark = $derived(t("message.you").slice(0, 1));
	let vote = $state<"good" | "bad" | null>(null);
	let copied = $state(false);

	function relativeTime(iso: string): string {
		const then = Date.parse(iso);
		if (!Number.isFinite(then)) return "";
		const minutes = Math.floor(Math.max(0, Date.now() - then) / 60000);
		if (minutes < 1) return t("message.justNow");
		if (minutes < 60) return t("message.minutesAgo").replace("{n}", String(minutes));
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return t("message.hoursAgo").replace("{n}", String(hours));
		return t("message.daysAgo").replace("{n}", String(Math.floor(hours / 24)));
	}

	async function copyText() {
		try {
			await navigator.clipboard.writeText(message.text);
			copied = true;
			setTimeout(() => (copied = false), 1200);
		} catch {
			copied = false;
		}
	}

	function toggleVote(next: "good" | "bad") {
		vote = vote === next ? null : next;
	}

	async function shareText() {
		try {
			if (navigator.share) {
				await navigator.share({ text: message.text });
				return;
			}
			await copyText();
		} catch {
			/* user cancelled share */
		}
	}
</script>

<Block tag="article" class="w-full" data-role={message.role}>
	{#if mine}
		<Group class="items-start gap-2">
			<Box
				class="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground"
				aria-hidden="true"
			>
				<Text tag="span">{youMark}</Text>
			</Box>
			<Stack align="stretch" class="min-w-0 flex-1 gap-2">
				<Group class="justify-between gap-2">
					<Group class="min-w-0 gap-2">
						<Text tag="span" class="text-sm font-semibold text-foreground">{t("message.you")}</Text>
						<Text tag="span" class="text-xs text-muted-foreground">{relativeTime(message.createdAt)}</Text>
					</Group>
					<Group class="gap-0">
						<Button
							class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
							aria-label={copied ? t("message.copied") : t("message.copy")}
							onclick={copyText}
						>
							<Icon size="sm"><Copy /></Icon>
						</Button>
						<Button
							class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
							aria-label={t("message.edit")}
							onclick={() => onEdit?.(message.text)}
						>
							<Icon size="sm"><Pencil /></Icon>
						</Button>
					</Group>
				</Group>
				<Box class="rounded bg-muted px-2 py-2 text-foreground">
					<Text tag="p" class="text-sm whitespace-pre-wrap">{message.text}</Text>
				</Box>
			</Stack>
		</Group>
	{:else}
		<Stack align="stretch" class="gap-6">
			{#if message.answer}
				<Stack align="stretch" class="gap-4" data-answer={message.mode ?? "build"}>
					<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						{message.mode === "ask" ? t("ask.answerAsk") : t("ask.answerBuild")}
					</Text>
					<MarkdownText source={message.text} />
					{#if message.plan}
						<AskPlanCard plan={message.plan} messageId={message.id} onApply={(selected) => applyPlanInBuild(message.id, selected)} />
					{/if}
					<AskBlockCards blocks={message.answer.blocks} onApplyVariant={(spec, variant) => applyVariantFromAsk(spec, variant)} />
				</Stack>
			{:else}
				<Text tag="p" class="text-sm font-medium whitespace-pre-wrap text-foreground">{body}</Text>
			{/if}
			{#if proposal && message.modelText}
				<MarkdownText source={message.modelText} />
			{/if}
			{#if proposal}
				<Group class="flex-wrap items-center gap-2">
					<Text tag="span" class="text-xs text-muted-foreground">
						{statusLabel}
					</Text>
					{#if pending}
						<Button
							class="rounded bg-foreground px-3 py-1 text-sm text-background hover:bg-foreground/90"
							onclick={() => (onApply ? onApply() : applyProposal())}
						>
							<Text tag="span">{t("proposal.apply")}</Text>
						</Button>
						<Button
							class="rounded border border-border px-3 py-1 text-sm text-foreground hover:bg-accent"
							onclick={() => (onDiscard ? onDiscard() : discardProposal())}
						>
							<Text tag="span">{t("proposal.discard")}</Text>
						</Button>
					{/if}
				</Group>
				{#if proposal.catalogRefs && (proposal.catalogRefs.blocks.length > 0 || proposal.catalogRefs.screen)}
					<CatalogRefsList refs={proposal.catalogRefs} demo={Boolean(proposal.demoData)} />
				{/if}
			{/if}
			{#if run}
				<Stack align="stretch" class="gap-2">
					<Text tag="p" class="font-mono text-[11px] text-muted-foreground">
						{t("usage.runModel").replace("{label}", run.modelLabel).replace("{id}", run.modelId)}
					</Text>
					<Text tag="p" class="text-[11px] text-muted-foreground">
						{t("usage.run")
							.replace("{status}", run.usage.status === "incomplete" ? t("usage.incomplete") : t("usage.complete"))
							.replace("{steps}", String(run.usage.steps))
							.replace("{prompt}", formatTokens(run.usage.promptTokens))
							.replace("{completion}", formatTokens(run.usage.completionTokens))
							.replace("{total}", formatTokens(run.usage.totalTokens))}
					</Text>
					{#if run.usage.reportedBy === "xai-provider"}
						<Text tag="p" class="text-[11px] text-muted-foreground">{t("usage.reportedBy")}. {t("usage.aggregation")}</Text>
						{#if run.usage.lastStep}
							<Text tag="p" class="text-[11px] text-muted-foreground">
								{t("usage.lastStep")
									.replace("{prompt}", formatTokens(run.usage.lastStep.promptTokens))
									.replace("{completion}", formatTokens(run.usage.lastStep.completionTokens))}
							</Text>
						{/if}
						{#if typeof run.usage.cachedTokens === "number"}
							<Text tag="p" class="text-[11px] text-muted-foreground">
								{t("usage.cached").replace("{cached}", formatTokens(run.usage.cachedTokens))}
							</Text>
						{/if}
					{/if}
					{#if run.tools && run.tools.length > 0}
						<Text tag="p" class="text-[11px] text-muted-foreground">
							{t("usage.tools").replace("{list}", run.tools.join(", "))}
						</Text>
					{/if}
					<Text tag="p" class="text-[11px] text-muted-foreground">{t("usage.noDollars")}</Text>
				</Stack>
			{/if}
			{#if showActivity && activity.length > 0}
				<Stack align="stretch" class="gap-2" role="list" aria-label={t("chat.activity")}>
					{#each activity as line (line)}
						<Group class="items-center gap-2" role="listitem">
							<Icon size="sm" class="text-muted-foreground"><FileText /></Icon>
							<Text tag="span" class="text-xs font-semibold text-foreground">{line}</Text>
						</Group>
					{/each}
				</Stack>
			{/if}
			<Group class="items-center gap-0" aria-label={t("chat.reactions")}>
				<Button
					class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
					aria-label={t("message.copy")}
					onclick={copyText}
				>
					<Icon size="sm"><Copy /></Icon>
				</Button>
				<Button
					class={cn(
						"inline-flex size-7 items-center justify-center rounded hover:bg-accent",
						vote === "good" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
					)}
					aria-label={t("message.good")}
					pressed={vote === "good"}
					onclick={() => toggleVote("good")}
				>
					<Icon size="sm"><ThumbsUp /></Icon>
				</Button>
				<Button
					class={cn(
						"inline-flex size-7 items-center justify-center rounded hover:bg-accent",
						vote === "bad" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
					)}
					aria-label={t("message.bad")}
					pressed={vote === "bad"}
					onclick={() => toggleVote("bad")}
				>
					<Icon size="sm"><ThumbsDown /></Icon>
				</Button>
				<Button
					class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
					aria-label={t("message.share")}
					onclick={shareText}
				>
					<Icon size="sm"><Share2 /></Icon>
				</Button>
			</Group>
		</Stack>
	{/if}
</Block>

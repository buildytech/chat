<script lang="ts">
	import UsageCost from "./UsageCost.svelte";
import { Copy, Check, Pencil, Share2, ThumbsDown, ThumbsUp } from "$lib/shell-icons";
	import { previewSettings } from "$lib/browser/preview-settings.svelte.ts";
 import Block from "$registry/compose/Block.svelte";
	import Disclosure from "$registry/kit/ui/disclosure/Disclosure.svelte";
	import Summary from "$registry/compose/Summary.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import type { ChatMessage as ChatMessageModel } from "$modules/chat/core";
	import { formatTokens } from "@buildytech/chat-agent";
	import MarkdownText from "./MarkdownText.svelte";
	import ProposalDiff from "./ProposalDiff.svelte";
	import { askAnswerActions } from "../core/ask-actions.ts";

	let {
		message,
		onEdit,
		onApply,
		onDiscard,
		onApplyInDesign,
	}: {
		message: ChatMessageModel;
		onEdit?: (text: string) => void;
		onApply?: () => void;
		onDiscard?: () => void;
		onApplyInDesign?: (text: string) => void;
	} = $props();

	const run = $derived(message.run);
	const proposal = $derived(message.proposal);
	const body = $derived(message.text);
	const askActions = $derived(message.mode === "ask" && message.answer ? askAnswerActions(message.text) : null);

	const mine = $derived(message.role === "user");

	let vote = $state<"good" | "bad" | null>(null);
	let copied = $state(false);
	let copyError = $state(false);
	const markdown = $derived(
		mine ? message.text : message.text,
	);

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
			await navigator.clipboard.writeText(markdown);
			copied = true;
			copyError = false;
			setTimeout(() => (copied = false), 1200);
		} catch {
			copied = false;
			copyError = true;
		}
	}

	function toggleVote(next: "good" | "bad") {
		vote = vote === next ? null : next;
	}

	async function shareText() {
		try {
			if (navigator.share) {
				await navigator.share({ text: markdown });
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
		<Group class="items-start justify-end gap-2">
			<Stack align="stretch" class="min-w-0 max-w-sm gap-2">
				<Group class="justify-between gap-2">
					<Group class="min-w-0 gap-2">
						<Text tag="span" class="text-sm font-semibold text-foreground">{t("message.you")}</Text>
						<Text tag="span" class="text-xs text-muted-foreground">{relativeTime(message.createdAt)}</Text>
					</Group>
					<Group class="gap-0">
						<Button
							class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
							aria-label={copied ? t("message.copied") : t("message.copy")}
							onclick={copyText}
						>
							<Icon size="sm"><Copy /></Icon>
						</Button>
						<Button
							class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
							aria-label={t("message.edit")}
							onclick={() => onEdit?.(message.text)}
						>
							<Icon size="sm"><Pencil /></Icon>
						</Button>
					</Group>
				</Group>
				<Box class="rounded bg-muted px-3 py-2 text-foreground">
					<Text tag="p" class="break-words text-xs leading-4 whitespace-pre-wrap">{message.text}</Text>
				</Box>
			</Stack>
		</Group>
	{:else}
		<Stack align="stretch" class="gap-4">
			{#if message.answer}
				<Stack align="stretch" class="gap-4" data-answer={message.mode ?? "build"}>
					<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						{message.mode === "ask" ? t("ask.answerAsk") : proposal ? t("ask.answerBuildProposal") : t("ask.answerBuild")}
					</Text>
					<MarkdownText source={message.text} />
					<!-- An answer without a proposal is a turn with no accepted write_page: the host says so, whatever the text claims (ADR 0035, 0071). -->
					{#if !proposal}
						{#if askActions?.claimsApplied}
							<Text tag="p" class="text-xs font-medium text-destructive" data-slot="ask-nothing-applied" role="status">{t("ask.nothingApplied")}</Text>
						{:else}
							<Text tag="p" class="text-xs font-medium text-muted-foreground" data-slot="no-change">{t("message.noChange")}</Text>
						{/if}
					{/if}
					{#if askActions?.offersDesign}
						<Group>
							<Button class="inline-flex h-7 items-center rounded border border-border px-2 text-xs text-foreground hover:bg-accent" data-action="ask-apply-in-design" onclick={() => onApplyInDesign?.(message.text)}>{t("ask.applyInDesign")}</Button>
						</Group>
					{/if}
				</Stack>
			{:else}
				<Text tag="p" class="break-words text-sm leading-relaxed whitespace-pre-wrap text-foreground">{body}</Text>
			{/if}
			{#if proposal && message.modelText}
				<MarkdownText source={message.modelText} />
			{/if}
			{#if proposal}
				<ProposalDiff {message} {onApply} {onDiscard} />
			{/if}
			{#if run && !previewSettings.hideServiceLabels}
				<Disclosure class="group">
					<Summary class="w-fit gap-2 rounded py-1 text-xs text-muted-foreground">{t("composer.details")}</Summary>
					<Stack align="stretch" class="gap-2 py-2">
						<Text tag="p" class="font-mono text-xs text-muted-foreground">
							{t("usage.runModel").replace("{label}", run.modelLabel).replace("{id}", run.modelId)}
						</Text>
						<Text tag="p" class="text-xs text-muted-foreground">
							{t("usage.run")
								.replace("{status}", run.usage.status === "incomplete" ? t("usage.incomplete") : t("usage.complete"))
								.replace("{steps}", String(run.usage.steps))
								.replace("{prompt}", formatTokens(run.usage.promptTokens))
								.replace("{completion}", formatTokens(run.usage.completionTokens))
								.replace("{total}", formatTokens(run.usage.totalTokens))}
						</Text>
						{#if run.usage.reportedBy !== "none"}
							<Text tag="p" class="text-xs text-muted-foreground"
								>{t("usage.reportedBy")}. {t("usage.aggregation")}</Text
							>
							{#if run.usage.lastStep}
								<Text tag="p" class="text-xs text-muted-foreground">
									{t("usage.lastStep")
										.replace("{prompt}", formatTokens(run.usage.lastStep.promptTokens))
										.replace("{completion}", formatTokens(run.usage.lastStep.completionTokens))}
								</Text>
							{/if}
							{#if typeof run.usage.cachedTokens === "number"}
								<Text tag="p" class="text-xs text-muted-foreground">
									{t("usage.cached").replace("{cached}", formatTokens(run.usage.cachedTokens))}
								</Text>
							{/if}
						{/if}
						{#if run.tools && run.tools.length > 0}
							<Text tag="p" class="text-xs text-muted-foreground">
								{t("usage.tools").replace("{list}", run.tools.join(", "))}
							</Text>
						{/if}
						<UsageCost cost={run.usage?.cost} />
					</Stack>
				</Disclosure>
			{/if}
			<Group class="items-center gap-0" aria-label={t("chat.reactions")}>
				<Button
					class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
					aria-label={copied ? t("message.copied") : t("message.copyMarkdown")}
					title={copied ? t("message.copied") : t("message.copyMarkdown")}
					onclick={copyText}
				>
					<Icon size="sm"
						>{#if copied}<Check />{:else}<Copy />{/if}</Icon
					>
				</Button>
				<Button
					class={cn(
						"inline-flex size-8 items-center justify-center rounded hover:bg-accent",
						vote === "good" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
					)}
					aria-label={t("message.good")}
					pressed={vote === "good"}
					onclick={() => toggleVote("good")}
				>
					<Icon size="sm"><ThumbsUp /></Icon>
				</Button>
				<Button
					class={cn(
						"inline-flex size-8 items-center justify-center rounded hover:bg-accent",
						vote === "bad" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
					)}
					aria-label={t("message.bad")}
					pressed={vote === "bad"}
					onclick={() => toggleVote("bad")}
				>
					<Icon size="sm"><ThumbsDown /></Icon>
				</Button>
				<Button
					class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
					aria-label={t("message.share")}
					onclick={shareText}
				>
					<Icon size="sm"><Share2 /></Icon>
				</Button>
			</Group>
		</Stack>
	{/if}
	{#if copyError}
		<Text tag="p" class="text-xs text-destructive" role="status">{t("message.copyFailed")}</Text>
	{:else if copied}
		<Text tag="span" class="sr-only" role="status">{t("message.copied")}</Text>
	{/if}
</Block>

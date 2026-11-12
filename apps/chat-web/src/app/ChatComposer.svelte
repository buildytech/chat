<script lang="ts">
	import ArrowUp from "@lucide/svelte/icons/arrow-up";
	import X from "@lucide/svelte/icons/x";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Form from "$registry/kit/ui/form/Form.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Label from "$registry/kit/ui/label/Label.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import Textarea from "$registry/kit/ui/textarea/Textarea.svelte";
	import Disclosure from "$registry/kit/ui/disclosure/Disclosure.svelte";
	import Summary from "$registry/compose/Summary.svelte";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import CollectionChips from "./CollectionChips.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import { getChatMode, setChatMode, type CreatorRuntimeStatus } from "$lib/chat-core";
	import { AGENT_MODES } from "@buildytech/builder-core";
	import {
		formatTokens,
		modelRunsToolLoop,
		modelUnavailableCode,
		type GrokChatModel,
		type SessionUsage,
	} from "@buildytech/builder-core";

	let {
		disabled = false,
		sendDisabled = false,
		onSend,
		onCancel,
		onAddModel,
		onSelectModel,
		onFocus,
		onBlur,
		onComposition,
		draft = $bindable(""),
		placeholder = "",
		variant = "thread",
		busy = false,
		chatModels = [],
		selectedModelId = "",
		sessionUsage = null,
		runtimeStatus = null,
	}: {
		disabled?: boolean;
		sendDisabled?: boolean;
		onSend: (text: string) => void | Promise<void>;
		onCancel?: () => void;
		onAddModel?: () => void;
		onSelectModel?: (id: string) => void;
		onFocus?: () => void;
		onBlur?: () => void;
		onComposition?: (next: boolean) => void;
		draft?: string;
		placeholder?: string;
		variant?: "thread" | "onboarding";
		busy?: boolean;
		chatModels?: readonly GrokChatModel[];
		selectedModelId?: string;
		sessionUsage?: SessionUsage | null;
		runtimeStatus?: CreatorRuntimeStatus | null;
	} = $props();

	let ime = $state(false);
	let modelOpen = $state(false);

	const selected = $derived(chatModels.find((m) => m.id === selectedModelId) ?? chatModels[0] ?? null);
	const modelButtonLabel = $derived(selected ? `${selected.label}` : t("composer.modelGrok"));

	const persistLabel = $derived(runtimeStatus ? t("persist.browserLocal") : "");
	const runtimeLabel = $derived.by(() => {
		if (!runtimeStatus) return "";
		const caps = runtimeStatus.capabilities;
		if (caps?.liveModel) return t("runtime.liveModel");
		if (caps?.note) return caps.note;
		if (runtimeStatus.mode === "mock") return t("runtime.mockMode");
		return t("runtime.localAssembler");
	});

	// Ask / Build is the author's explicit choice (kept per chat); the host never guesses it from words.
	const mode = $derived(getChatMode());
	const fieldPlaceholder = $derived(
		mode === "ask" ? t("composer.placeholderAsk") : placeholder || t("composer.placeholder"),
	);
	const cannotSend = $derived(disabled || sendDisabled || !(draft.trim() || variant === "thread"));

	function submit(event: Event) {
		event.preventDefault();
		const text = draft.trim();
		if (cannotSend) return;
		onSend(text);
		if (variant === "thread") draft = "";
	}

	function closeModelMenu() {
		if (!modelOpen) return;
		modelOpen = false;
		queueMicrotask(() => document.getElementById("composer-model-trigger")?.focus());
	}

	function onEscape(event: KeyboardEvent) {
		if (event.key !== "Escape" || !modelOpen) return;
		event.preventDefault();
		closeModelMenu();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			onEscape(event);
			return;
		}
		if (ime || event.isComposing || !(event.target instanceof HTMLTextAreaElement)) return;
		if (event.key === "Enter" && !event.shiftKey) {
			if (modelOpen) return;
			event.preventDefault();
			submit(event);
		}
	}

	function chooseModel(id: string) {
		onSelectModel?.(id);
		closeModelMenu();
	}
</script>

<svelte:window
	onkeydown={onEscape}
	onclick={(event) => {
		if (
			modelOpen &&
			event.target instanceof Element &&
			!event.target.closest("#composer-model-list, #composer-model-trigger")
		)
			modelOpen = false;
	}}
/>

<Block
	tag="footer"
	class={cn("shrink-0 bg-background p-2", variant === "thread" && "sticky bottom-0 z-10 lg:static lg:z-0")}
	data-slot="composer-region"
>
	<Form class="relative flex flex-col gap-2" onsubmit={submit} onkeydown={onKeydown}>
		<CollectionChips />
		<Stack align="stretch" class="gap-2 rounded border border-input bg-card p-2" data-slot="composer-surface">
			<Label for="composer" class="sr-only">{t("composer.label")}</Label>
			<Textarea
				id="composer"
				name="message"
				rows="3"
				placeholder={fieldPlaceholder}
				class="min-h-16 w-full resize-none overflow-y-auto rounded border-0 bg-transparent px-2 py-2 text-sm leading-relaxed text-foreground shadow-none outline-none"
				value={draft}
				aria-describedby="composer-hint"
				oninput={(event: Event) => (draft = (event.currentTarget as HTMLTextAreaElement).value)}
				onfocus={onFocus}
				onblur={onBlur}
				oncompositionstart={() => {
					ime = true;
					onComposition?.(true);
				}}
				oncompositionend={() => {
					ime = false;
					onComposition?.(false);
				}}
				{disabled}
			/>
			<Group class="items-end justify-between gap-2" data-slot="composer-actions">
				<Group class="min-w-0 flex-1 flex-wrap items-center gap-2">
					<Group
						class="w-fit items-center gap-0 rounded bg-muted p-1"
						role="group"
						aria-label={t("composer.modeLabel")}
					>
						{#each AGENT_MODES as option (option)}
							<Button
								type="button"
								class={cn(
									"h-6 rounded px-2 text-xs font-medium",
									mode === option ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
								)}
								pressed={mode === option}
								title={t(`composer.mode.${option}.hint`)}
								data-mode={option}
								onclick={() => setChatMode(option)}
							>
								<Text tag="span">{t(`composer.mode.${option}`)}</Text>
							</Button>
						{/each}
					</Group>
					<Button
						id="composer-model-trigger"
						type="button"
						class="inline-flex h-8 min-w-24 flex-1 items-center justify-start gap-1 rounded px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
						aria-label={t("composer.model")}
						title={modelButtonLabel}
						expanded={modelOpen}
						aria-controls="composer-model-list"
						onclick={() => {
							if (modelOpen) {
								closeModelMenu();
								return;
							}
							modelOpen = true;
							queueMicrotask(() =>
								document.querySelector<HTMLButtonElement>("#composer-model-list button:not(:disabled)")?.focus(),
							);
						}}
					>
						<Text tag="span" class="truncate">{modelButtonLabel}</Text><Icon size="sm"><ChevronDown /></Icon>
					</Button>
				</Group>
				<Group class="shrink-0 items-center gap-2">
					{#if busy && onCancel}
						<Button
							type="button"
							class="inline-flex size-8 items-center justify-center rounded-full bg-accent text-foreground"
							aria-label={t("composer.cancel")}
							onclick={onCancel}><Icon size="sm"><X /></Icon></Button
						>
					{:else}
						<Button
							type="submit"
							disabled={cannotSend}
							class="inline-flex size-8 items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
							aria-label={t("composer.send")}><Icon size="sm"><ArrowUp /></Icon></Button
						>
					{/if}
				</Group>
			</Group>
		</Stack>
		<Text tag="p" id="composer-hint" class="px-2 text-xs text-muted-foreground">{t("composer.enterHint")}</Text>
		{#if modelOpen}
			<Stack
				align="stretch"
				id="composer-model-list"
				class="absolute inset-x-0 bottom-full z-20 mb-2 max-h-64 gap-1 overflow-y-auto rounded bg-popover p-2"
				role="group"
				aria-label={t("composer.modelList")}
			>
				{#each chatModels as model (model.id)}
					<Button
						type="button"
						class={cn(
							"w-full rounded px-2 py-2 text-left disabled:opacity-50",
							model.id === selectedModelId ? "bg-accent" : "hover:bg-accent",
						)}
						pressed={model.id === selectedModelId}
						disabled={!modelRunsToolLoop(model)}
						onclick={() => chooseModel(model.id)}
					>
						<Stack align="stretch" class="min-w-0 gap-1">
							<Text tag="span" class="text-sm text-foreground">{model.label}</Text>
							<Text tag="span" class="break-all font-mono text-xs text-muted-foreground">{model.id}</Text>
							{#if !modelRunsToolLoop(model)}<Text tag="span" class="text-xs text-muted-foreground"
									>{t(
										modelUnavailableCode(model) === "model_too_slow"
											? "composer.modelTooSlow"
											: "composer.modelUnavailable",
									)}</Text
								>{/if}
						</Stack>
					</Button>
				{/each}
				<Button
					type="button"
					class="rounded px-2 py-2 text-left text-sm text-foreground hover:bg-accent"
					onclick={() => {
						modelOpen = false;
						onAddModel?.();
					}}><Text tag="span">{t("composer.addModel")}</Text></Button
				>
				<Text tag="p" class="px-2 text-xs text-muted-foreground">{t("composer.modelTrialHint")}</Text>
			</Stack>
		{/if}
		<Disclosure class="group px-2" data-slot="composer-details">
			<Summary class="w-fit gap-2 rounded py-1 text-xs text-muted-foreground">{t("composer.details")}</Summary>
			<Stack align="stretch" class="gap-2 py-2">
				{#if selected}<Text tag="p" class="break-all font-mono text-xs text-muted-foreground">{selected.id}</Text>{/if}
				{#if sessionUsage}
					<Text tag="p" class="text-xs text-muted-foreground" role="status"
						>{t("usage.session")
							.replace("{status}", sessionUsage.status === "incomplete" ? t("usage.incomplete") : t("usage.complete"))
							.replace("{prompt}", formatTokens(sessionUsage.promptTokens))
							.replace("{completion}", formatTokens(sessionUsage.completionTokens))
							.replace("{total}", formatTokens(sessionUsage.totalTokens))
							.replace("{runs}", String(sessionUsage.runs))}</Text
					>
					<Text tag="p" class="text-xs text-muted-foreground">{t("usage.noDollars")}</Text>
				{/if}
				{#if persistLabel}<Text tag="p" class="text-xs text-muted-foreground">{persistLabel}</Text>{/if}
				{#if runtimeLabel}<Text tag="p" class="text-xs text-muted-foreground">{runtimeLabel}</Text>{/if}
			</Stack>
		</Disclosure>
		{#if runtimeStatus?.error}<Text tag="p" class="px-2 text-xs text-destructive" role="status"
				>{runtimeStatus.error}</Text
			>{/if}
	</Form>
</Block>

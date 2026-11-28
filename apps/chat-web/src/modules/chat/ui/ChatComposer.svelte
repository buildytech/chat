<script lang="ts">
	import { Send, X, Check, ChevronDown } from "$lib/shell-icons";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Form from "$registry/kit/ui/form/Form.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Label from "$registry/kit/ui/label/Label.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import Textarea from "$registry/kit/ui/textarea/Textarea.svelte";
	import ComposerDetails from "./ComposerDetails.svelte";
	import ComposerModelList from "./ComposerModelList.svelte";
	import ComposerScope from "./ComposerScope.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { valueOf } from "$lib/inspector/fields";
	import { cn } from "$registry/utils/cn";
	import type { CreatorRuntimeStatus } from "$modules/chat/core";
	import { COMPOSER_MODES, getComposerMode, setComposerMode } from "../core/composer-mode.svelte.ts";
	import type { GrokChatModel, SessionUsage } from "@buildytech/chat-agent";

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
	let modeOpen = $state(false);

	const selected = $derived(chatModels.find((m) => m.id === selectedModelId) ?? chatModels[0] ?? null);
	const modelButtonLabel = $derived(selected ? `${selected.label}` : t("composer.modelGrok"));

	const persistLabel = $derived(runtimeStatus ? t("persist.browserLocal") : "");
	const runtimeLabel = $derived.by(() => {
		if (!runtimeStatus) return "";
		const caps = runtimeStatus.capabilities;
		if (caps?.liveModel) return t("runtime.liveModel");
		if (caps?.note === "runtime.liveOnSend") return t("runtime.liveOnSend");
		if (caps?.note) return caps.note;
		if (runtimeStatus.mode === "mock") return t("runtime.mockMode");
		return t("runtime.localAssembler");
	});

	// Ask / Build is the author's explicit choice (kept per chat); the host never guesses it from words.
	const mode = $derived(getComposerMode());
	const fieldPlaceholder = $derived(
		mode === "ask" ? t("composer.placeholderAsk") : mode === "media" ? t("composer.placeholderMedia") : mode === "design" ? t("composer.placeholderDesign") : placeholder || t("composer.placeholder"),
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

	function closeModeMenu() {
		if (!modeOpen) return;
		modeOpen = false;
		queueMicrotask(() => document.getElementById("composer-mode-trigger")?.focus());
	}

	function onEscape(event: KeyboardEvent) {
		if (event.key !== "Escape" || (!modelOpen && !modeOpen)) return;
		event.preventDefault();
		if (modeOpen) closeModeMenu();
		else closeModelMenu();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			onEscape(event);
			return;
		}
		if (ime || event.isComposing || !(event.target instanceof HTMLTextAreaElement)) return;
		if (event.key === "Enter" && !event.shiftKey) {
			if (modelOpen || modeOpen) return;
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
		if (!(event.target instanceof Element)) return;
		if (modelOpen && !event.target.closest("#composer-model-list, #composer-model-trigger")) modelOpen = false;
		if (modeOpen && !event.target.closest("#composer-mode-list, #composer-mode-trigger")) modeOpen = false;
	}}
/>

<Block
	class="shrink-0 bg-background p-2"
	data-slot="composer-region"
>
	<Form class="relative flex flex-col gap-2" onsubmit={submit} onkeydown={onKeydown}>
		<ComposerScope />
		<Stack align="stretch" class="gap-2 rounded border border-input bg-card p-1" data-slot="composer-surface">
			<Label for="composer" class="sr-only">{t("composer.label")}</Label>
			<Textarea
				id="composer"
				name="message"
				rows="3"
				placeholder={fieldPlaceholder}
				class="min-h-16 w-full resize-none overflow-y-auto rounded border-0 bg-transparent px-2 py-2 text-xs leading-4 text-foreground shadow-none outline-none"
				value={draft}
				aria-describedby="composer-hint"
				oninput={(event: Event) => (draft = valueOf(event))}
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
			<Group class="relative items-end justify-between gap-2" data-slot="composer-actions">
				<!-- The menus open above this row (not above the whole form), so a tall prompt never carries them off screen. -->
				<Block class="absolute inset-x-0 bottom-full" data-slot="composer-menus">
				{#if modeOpen}
					<Stack
						align="stretch"
						id="composer-mode-list"
						class="absolute bottom-full left-0 z-20 mb-2 w-56 max-h-[min(16rem,50dvh)] overflow-y-auto gap-1 rounded bg-popover p-1"
						role="group"
						aria-label={t("composer.modeLabel")}
					>
						{#each COMPOSER_MODES as option (option)}
							<Button
								type="button"
								class={cn(
									"w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs",
									mode === option ? "bg-accent text-foreground" : "text-foreground hover:bg-accent",
								)}
								pressed={mode === option}
								title={t(`composer.mode.${option}.hint`)}
								data-mode={option}
								onclick={() => {
									setComposerMode(option);
									closeModeMenu();
								}}
							>
								<Text tag="span">{t(`composer.mode.${option}`)}</Text>
								{#if mode === option}<Icon size="sm"><Check /></Icon>{/if}
							</Button>
						{/each}
					</Stack>
				{/if}
				{#if modelOpen}
					<ComposerModelList
						{chatModels}
						{selectedModelId}
						onChoose={chooseModel}
						onAddModel={() => {
							modelOpen = false;
							onAddModel?.();
						}}
					/>
				{/if}
				</Block>
				<Group class="min-w-0 flex-1 flex-wrap items-center gap-2">
					<Button
						id="composer-mode-trigger"
						type="button"
						class="inline-flex h-6 w-fit items-center gap-1 rounded px-2 text-xs text-foreground hover:bg-accent"
						aria-label={t("composer.modeLabel")}
						title={t(`composer.mode.${mode}.hint`)}
						expanded={modeOpen}
						aria-controls="composer-mode-list"
						data-mode={mode}
						onclick={() => {
							if (modeOpen) {
								closeModeMenu();
								return;
							}
							modelOpen = false;
							modeOpen = true;
						}}
					>
						<Text tag="span">{t(`composer.mode.${mode}`)}</Text>
						<Icon size="sm"><ChevronDown /></Icon>
					</Button>
					<Button
						id="composer-model-trigger"
						type="button"
						class="inline-flex h-6 w-fit shrink-0 items-center justify-start gap-1 rounded px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
						aria-label={t("composer.model")}
						title={modelButtonLabel}
						expanded={modelOpen}
						aria-controls="composer-model-list"
						onclick={() => {
							if (modelOpen) {
								closeModelMenu();
								return;
							}
							modeOpen = false;
							modelOpen = true;
							queueMicrotask(() =>
								document.querySelector<HTMLButtonElement>("#composer-model-list button:not(:disabled)")?.focus(),
							);
						}}
					>
						<Text tag="span">{modelButtonLabel}</Text><Icon size="sm"><ChevronDown /></Icon>
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
							class={cn(
								"inline-flex size-7 items-center justify-center rounded-full disabled:opacity-50",
								mode === "ask"
									? "bg-chart-2 text-background hover:bg-chart-2/90"
									: "bg-foreground text-background hover:bg-foreground/90",
							)}
							aria-label={t("composer.send")}><Icon><Send /></Icon></Button
						>
					{/if}
				</Group>
			</Group>
		</Stack>
		<Text tag="p" id="composer-hint" class="px-2 text-xs text-muted-foreground">{t("composer.enterHint")}</Text>
		<ComposerDetails {selected} {sessionUsage} {persistLabel} {runtimeLabel} />
		{#if runtimeStatus?.error}<Text tag="p" class="px-2 text-xs text-destructive" role="status"
				>{runtimeStatus.error}</Text
			>{/if}
	</Form>
</Block>

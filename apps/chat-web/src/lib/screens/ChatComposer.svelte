<script lang="ts">
	import ArrowUp from "@lucide/svelte/icons/arrow-up";
	import X from "@lucide/svelte/icons/x";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Form from "../../ui/form/Form.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Label from "../../ui/label/Label.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Textarea from "../../ui/textarea/Textarea.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import type { CreatorRuntimeStatus } from "../chat-core";
	import { formatTokens, modelRunsToolLoop, modelUnavailableCode, type GrokChatModel, type SessionUsage } from "@buildytech/builder-core";

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
		runtimeStatus = null
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
	const modelButtonLabel = $derived(
		selected ? `${selected.label}` : t("composer.modelGrok")
	);

	const persistLabel = $derived(
		runtimeStatus?.mode === "mock" ? t("persist.browserLocal") : ""
	);
	const runtimeLabel = $derived.by(() => {
		if (!runtimeStatus) return "";
		const caps = runtimeStatus.capabilities;
		if (caps?.liveModel) return t("runtime.liveModel");
		if (caps?.note) return caps.note;
		if (runtimeStatus.mode === "mock") return t("runtime.mockMode");
		return t("runtime.localAssembler");
	});

	const fieldPlaceholder = $derived(placeholder || t("composer.placeholder"));
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
		if (ime || event.isComposing) return;
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

<svelte:window onkeydown={onEscape} />

<Block
	tag="footer"
	class={cn(
		variant === "onboarding"
			? "w-full rounded-default border border-border bg-card px-3 py-3"
			: "sticky bottom-0 z-10 mt-auto border-t border-border bg-background px-3 py-3 lg:static lg:z-auto"
	)}
>
	<Form class="flex flex-col gap-2" onsubmit={submit} onkeydown={onKeydown}>
		<Label for="composer" class="sr-only">{t("composer.label")}</Label>
		<Textarea
			id="composer"
			name="message"
			rows="2"
			placeholder={fieldPlaceholder}
			class="max-h-[30vh] min-h-16 w-full resize-none overflow-y-auto rounded-default border border-input bg-card px-3 py-2 text-sm text-foreground shadow-none outline-none ring-ring focus-visible:ring-2"
			bind:value={draft}
			onkeydown={onKeydown}
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
			disabled={disabled}
		/>
		<Text tag="p" class="text-[11px] text-muted-foreground">{t("composer.enterHint")}</Text>
		<Group class="items-center justify-between gap-2">
			<Group class="items-center gap-2">
				<Button
					id="composer-model-trigger"
					type="button"
					class="inline-flex max-w-[220px] items-center gap-1 rounded-default border border-border px-2 py-1.5 text-sm text-foreground hover:bg-accent"
					aria-label={t("composer.model")}
					aria-expanded={modelOpen ? "true" : "false"}
					aria-haspopup="listbox"
					aria-controls="composer-model-list"
					onclick={() => {
						if (modelOpen) {
							closeModelMenu();
							return;
						}
						modelOpen = true;
						queueMicrotask(() =>
							(document.querySelector("#composer-model-list [role=option]") as HTMLElement | null)?.focus()
						);
					}}
				>
					<Text tag="span" class="truncate">{modelButtonLabel}</Text>
				</Button>
				<Button
					type="button"
					class="rounded-default border border-border px-2 py-1.5 text-sm text-foreground hover:bg-accent"
					onclick={() => {
						modelOpen = false;
						onAddModel?.();
					}}
				>
					<Text tag="span">{t("composer.addModel")}</Text>
				</Button>
			</Group>
			<Group class="items-center gap-2">
				{#if busy && onCancel}
					<Button
						class="inline-flex size-8 items-center justify-center rounded-default border border-border text-foreground hover:bg-accent"
						aria-label={t("composer.cancel")}
						onclick={onCancel}
					>
						<Icon size="sm"><X /></Icon>
					</Button>
				{/if}
				<Button
					type="submit"
					disabled={cannotSend}
					class="inline-flex size-8 items-center justify-center rounded-default bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
					aria-label={t("composer.send")}
				>
					<Icon size="sm"><ArrowUp /></Icon>
				</Button>
			</Group>
		</Group>
		{#if modelOpen && chatModels.length > 0}
			<Stack id="composer-model-list" class="gap-1 rounded-default border border-border bg-card p-2" role="listbox" aria-label={t("composer.modelList")}>
				{#each chatModels as model (model.id)}
					<Button
						type="button"
						class={cn(
							"w-full items-start justify-start rounded-default px-2 py-1.5 text-left",
							modelRunsToolLoop(model) ? "hover:bg-accent" : "cursor-not-allowed opacity-60",
							model.id === selectedModelId ? "bg-accent" : ""
						)}
						role="option"
						aria-selected={model.id === selectedModelId ? "true" : "false"}
						aria-disabled={modelRunsToolLoop(model) ? undefined : "true"}
						disabled={!modelRunsToolLoop(model)}
						onclick={() => chooseModel(model.id)}
					>
						<Stack class="gap-0.5">
							<Text tag="span" class="text-sm text-foreground">{model.label}</Text>
							<Text tag="span" class="font-mono text-[11px] text-muted-foreground">{model.id}</Text>
							{#if !modelRunsToolLoop(model)}
								<Text tag="span" class="text-[11px] text-muted-foreground">{t(modelUnavailableCode(model) === "model_too_slow" ? "composer.modelTooSlow" : "composer.modelUnavailable")}</Text>
							{/if}
						</Stack>
					</Button>
				{/each}
				<Text tag="p" class="px-2 pt-1 text-[11px] text-muted-foreground">{t("composer.modelTrialHint")}</Text>
			</Stack>
		{/if}
		{#if selected}
			<Text tag="p" class="font-mono text-[11px] text-muted-foreground">
				{t("composer.selectedModel").replace("{label}", selected.label).replace("{id}", selected.id)}
			</Text>
		{/if}
		{#if sessionUsage}
			<Text tag="p" class="text-[11px] text-muted-foreground" role="status">
				{t("usage.session")
					.replace("{status}", sessionUsage.status === "incomplete" ? t("usage.incomplete") : t("usage.complete"))
					.replace("{prompt}", formatTokens(sessionUsage.promptTokens))
					.replace("{completion}", formatTokens(sessionUsage.completionTokens))
					.replace("{total}", formatTokens(sessionUsage.totalTokens))
					.replace("{runs}", String(sessionUsage.runs))}
			</Text>
			<Text tag="p" class="text-[11px] text-muted-foreground">{t("usage.noDollars")}</Text>
		{/if}
		{#if persistLabel}
			<Text tag="p" class="text-[11px] text-muted-foreground">{persistLabel}</Text>
		{/if}
		{#if runtimeLabel || runtimeStatus?.error}
			<Group class="items-center justify-between gap-2">
				{#if runtimeLabel}
					<Text tag="span" class="text-[11px] text-muted-foreground">{runtimeLabel}</Text>
				{/if}
				{#if runtimeStatus?.error}
					<Text tag="span" class="text-[11px] text-destructive" role="status">{runtimeStatus.error}</Text>
				{/if}
			</Group>
		{/if}
	</Form>
</Block>

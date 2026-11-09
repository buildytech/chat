<script lang="ts">
	import { onMount } from "svelte";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Input from "$registry/kit/ui/input/Input.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import Title from "$registry/compose/Title.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";
	import {
		ROTATION_MS,
		attachScreen,
		catalogPage,
		clearScenario,
		getStockQuery,
		closeModal,
		currentPlaceholder,
		getKeepOutsideScreen,
		getModal,
		getPage,
		getScenarioId,
		getScreenId,
		openModal,
		removeScreen,
		rotatePlaceholder,
		scenarioPrompt,
		screenJson,
		screenOutsideFilter,
		selectScenario,
		selectedCompatibility,
		sendBrief,
		setComposing,
		setFocused,
		setKeepOutsideScreen,
		setPage,
		setStockQuery
	} from "$lib/browser/onboarding.svelte";
	import type { CreatorRuntimeStatus } from "$lib/chat-core";
	import type { GrokChatModel, ScenarioId, SessionUsage } from "@buildytech/builder-core";
	import StockCard from "./StockCard.svelte";
	import ChatComposer from "./ChatComposer.svelte";
	import ContextModal from "./ContextModal.svelte";
	import AddModelDialog from "./AddModelDialog.svelte";

	let {
		busy = false,
		runtimeStatus = null,
		onSend,
		onCancel,
		onAddModel,
		onSelectModel,
		chatModels = [],
		selectedModelId = "",
		sessionUsage = null
	}: {
		busy?: boolean;
		runtimeStatus?: CreatorRuntimeStatus | null;
		onSend: (text: string) => void | Promise<void>;
		onCancel?: () => void;
		onAddModel?: () => void;
		onSelectModel?: (id: string) => void;
		chatModels?: readonly GrokChatModel[];
		selectedModelId?: string;
		sessionUsage?: SessionUsage | null;
	} = $props();

	let draft = $state("");
	const scenario = $derived(getScenarioId());
	const screen = $derived(getScreenId());
	const modal = $derived(getModal());
	const result = $derived.by(() => {
		void getScenarioId();
		void getPage();
		void getStockQuery();
		return catalogPage();
	});
	const stockQuery = $derived(getStockQuery());
	const placeholder = $derived.by(() => {
		void getScenarioId();
		void currentPlaceholder();
		return currentPlaceholder();
	});
	const prompt = $derived(scenarioPrompt());
	const json = $derived(screenJson());
	const outside = $derived(screenOutsideFilter());
	const compat = $derived(selectedCompatibility());
	const canSend = $derived(Boolean(draft.trim() || prompt));

	const ideas: Array<{ id: ScenarioId; label: string }> = [
		{ id: "dashboard", label: t("home.ideaDashboard") },
		{ id: "landing", label: t("home.ideaLanding") },
		{ id: "website", label: t("home.ideaWebsite") }
	];

	onMount(() => {
		const reduced =
			typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduced) return;
		const timer = window.setInterval(() => {
			rotatePlaceholder(document.hidden, reduced);
		}, ROTATION_MS);
		return () => window.clearInterval(timer);
	});

	function submitDraft(text: string) {
		const ready = sendBrief(text);
		if (!ready.ok) return;
		onSend(ready.brief);
		draft = "";
	}
</script>

<Block tag="section" class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background" aria-label={t("empty.title")}>
	<Stack align="stretch" class="mx-auto w-full max-w-5xl gap-8 px-4 py-10">
		<Stack class="items-center gap-4 text-center">
			<Title as={1} class="text-2xl font-semibold text-foreground">{t("empty.title")}</Title>
			<Text tag="p" class="max-w-xl text-sm text-muted-foreground">{t("empty.subtitle")}</Text>
			<Group class="flex-wrap justify-center gap-2" aria-label={t("home.ideas")}>
				{#each ideas as idea (idea.id)}
					<Button
						class={cn(
							"rounded border px-3 py-1.5 text-sm",
							scenario === idea.id
								? "border-primary bg-accent text-foreground"
								: "border-border text-foreground hover:bg-accent"
						)}
						pressed={scenario === idea.id}
						onclick={() => selectScenario(idea.id)}
					>
						<Text tag="span">{idea.label}</Text>
					</Button>
				{/each}
			</Group>
			{#if prompt || screen}
				<Group class="flex-wrap justify-center gap-2">
					{#if prompt}
						<Group class="items-center gap-1 rounded border border-border bg-card px-2 py-1">
							<Button
								class="text-xs font-medium text-foreground"
								onclick={() => openModal("scenario")}
								aria-label={t("badge.openScenario")}
							>
								<Text tag="span">{prompt.label}</Text>
							</Button>
							<Button class="text-xs text-muted-foreground" onclick={clearScenario} aria-label={t("badge.removeScenario")}>
								<Text tag="span">×</Text>
							</Button>
						</Group>
					{/if}
					{#if screen}
						<Group class="items-center gap-1 rounded border border-border bg-card px-2 py-1">
							<Button
								class="text-xs font-medium text-foreground"
								onclick={() => openModal("screen")}
								aria-label={t("badge.openScreen")}
							>
								<Text tag="span">{screen}</Text>
							</Button>
							<Button class="text-xs text-muted-foreground" onclick={removeScreen} aria-label={t("badge.removeScreen")}>
								<Text tag="span">×</Text>
							</Button>
						</Group>
					{/if}
				</Group>
			{/if}
			{#if outside && screen && getKeepOutsideScreen()}
				<Group class="flex-wrap justify-center gap-2">
					<Text tag="span" class="text-xs text-muted-foreground">{t("home.outsideFilter")}</Text>
					<Button class="text-xs text-foreground" onclick={() => setKeepOutsideScreen(true)}>
						<Text tag="span">{t("home.keepScreen")}</Text>
					</Button>
					<Button class="text-xs text-foreground" onclick={removeScreen}>
						<Text tag="span">{t("home.removeScreen")}</Text>
					</Button>
				</Group>
			{/if}
		</Stack>

		<ChatComposer
			variant="onboarding"
			disabled={busy}
			sendDisabled={!canSend || busy}
			placeholder={placeholder}
			{busy}
			{runtimeStatus}
			{chatModels}
			{selectedModelId}
			{sessionUsage}
			bind:draft
			onSend={submitDraft}
			{onCancel}
			onAddModel={() => {
				onAddModel?.();
				openModal("model");
			}}
			{onSelectModel}
			onFocus={() => setFocused(true)}
			onBlur={() => setFocused(false)}
			onComposition={(next) => setComposing(next)}
		/>

		<Stack align="stretch" class="gap-4">
			<Group class="flex-wrap items-center justify-between gap-2">
				<Title as={2} class="text-sm font-semibold text-foreground">{t("home.stock")}</Title>
				<Group class="min-w-0 flex-1 items-center justify-end gap-2">
					<Input
						id="stock-search"
						type="search"
						value={stockQuery}
						placeholder={t("home.stockSearch")}
						aria-label={t("home.stockSearch")}
						class="min-w-0 max-w-xs flex-1 rounded border border-input bg-card px-3 py-1.5 text-sm"
						oninput={(event: Event) => {
							setStockQuery((event.currentTarget as HTMLInputElement).value);
						}}
					/>
					{#if scenario}
						<Button class="text-sm text-muted-foreground hover:text-foreground" onclick={clearScenario}>
							<Text tag="span">{t("home.clearScenario")}</Text>
						</Button>
					{/if}
				</Group>
			</Group>
			{#if result.total === 0}
				<Text tag="p" class="text-sm text-muted-foreground">{t("home.stockEmpty")}</Text>
			{:else}
				<Stack align="stretch" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each result.items as item (item.screenId)}
						<StockCard
							screen={item}
							compatibility={item.compatibility}
							selected={screen === item.screenId}
							onAttach={(id) => attachScreen(id)}
						/>
					{/each}
				</Stack>
				{#if result.total > result.pageSize}
					<Group class="items-center justify-center gap-3">
						<Button
							class="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
							disabled={result.page <= 1}
							onclick={() => setPage(result.page - 1)}
							aria-label={t("home.prevPage")}
						>
							<Text tag="span">{t("home.prevPage")}</Text>
						</Button>
						<Text tag="span" class="text-sm text-muted-foreground">
							{t("home.pageOf").replace("{page}", String(result.page)).replace("{pages}", String(result.pageCount))}
						</Text>
						<Button
							class="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50"
							disabled={result.page >= result.pageCount}
							onclick={() => setPage(result.page + 1)}
							aria-label={t("home.nextPage")}
						>
							<Text tag="span">{t("home.nextPage")}</Text>
						</Button>
					</Group>
				{/if}
			{/if}
		</Stack>
	</Stack>
</Block>

{#if modal === "scenario" && prompt}
	<ContextModal title={t("modal.scenarioTitle")} description={`${prompt.id} · v${prompt.version}`} body={prompt.text} onClose={closeModal} />
{/if}
{#if modal === "screen" && json}
	<ContextModal
		title={t("modal.screenTitle")}
		description={t("modal.bytes").replace("{n}", String(json.bytes))}
		body={JSON.stringify(json.json, null, 2)}
		json
		onClose={closeModal}
	/>
{/if}
{#if modal === "model"}
	<AddModelDialog onClose={closeModal} />
{/if}

{#if compat && !compat.compatible && !compat.partial}
	<Text tag="p" class="sr-only">{t("home.incompatible")}</Text>
{/if}

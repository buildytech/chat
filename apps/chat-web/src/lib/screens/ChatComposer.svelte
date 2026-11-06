<script lang="ts">
	import ArrowUp from "@lucide/svelte/icons/arrow-up";
	import Check from "@lucide/svelte/icons/check";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import FileText from "@lucide/svelte/icons/file-text";
	import Plus from "@lucide/svelte/icons/plus";
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

	type ModelId = "gpt" | "claude" | "grok" | "gemini";

	const models: { id: ModelId; short: string; full: string }[] = [
		{ id: "gpt", short: t("composer.modelGpt"), full: t("composer.modelGptFull") },
		{ id: "claude", short: t("composer.modelClaude"), full: t("composer.modelClaudeFull") },
		{ id: "grok", short: t("composer.modelGrok"), full: t("composer.modelGrokFull") },
		{ id: "gemini", short: t("composer.modelGemini"), full: t("composer.modelGeminiFull") }
	];

	let {
		disabled = false,
		onSend,
		draft = $bindable("")
	}: {
		disabled?: boolean;
		onSend: (text: string) => void;
		draft?: string;
	} = $props();

	let model = $state<ModelId>("gpt");
	let modelOpen = $state(false);
	let showDesign = $state(true);

	const picked = $derived(models.find((item) => item.id === model) ?? models[0]);

	function submit(event: Event) {
		event.preventDefault();
		const text = draft.trim();
		if (!text || disabled) return;
		onSend(text);
		draft = "";
	}

	function onKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
			event.preventDefault();
			submit(event);
		}
	}

	function pickModel(id: ModelId) {
		model = id;
		modelOpen = false;
	}

	function closeMenus() {
		modelOpen = false;
	}
</script>

<svelte:window onclick={closeMenus} />

<Block tag="footer" class="sticky bottom-0 z-10 mt-auto border-t border-border bg-background px-3 py-3 lg:static lg:z-auto">
	<Form class="flex flex-col gap-2" onsubmit={submit}>
		{#if showDesign}
			<Group class="flex-wrap gap-2">
				<Group class="items-center gap-2 rounded-default border border-border bg-card px-2 py-1">
					<Icon size="sm" class="text-muted-foreground"><FileText /></Icon>
					<Text tag="span" class="text-xs font-medium">{t("composer.attachmentDesign")}</Text>
					<Button
						class="inline-flex size-5 items-center justify-center rounded-default text-muted-foreground hover:bg-accent hover:text-foreground"
						aria-label={t("composer.removeAttachment")}
						onclick={() => (showDesign = false)}
					>
						<Icon size="sm"><X /></Icon>
					</Button>
				</Group>
			</Group>
		{/if}
		<Label for="composer" class="sr-only">{t("composer.label")}</Label>
		<Textarea
			id="composer"
			name="message"
			rows="2"
			placeholder={t("composer.placeholder")}
			class="min-h-16 w-full resize-none rounded-default border border-input bg-card px-3 py-2 text-sm text-foreground shadow-none outline-none ring-ring focus-visible:ring-2"
			bind:value={draft}
			onkeydown={onKeydown}
			disabled={disabled}
		/>
		<Group class="items-center justify-between gap-2">
			<Group class="items-center gap-2">
				<Button
					class="inline-flex size-8 items-center justify-center rounded-default border border-border text-foreground hover:bg-accent"
					aria-label={t("composer.add")}
					onclick={() => (showDesign = true)}
				>
					<Icon size="sm"><Plus /></Icon>
				</Button>
				<Block class="relative">
					<Button
						class="inline-flex items-center gap-1 rounded-default border border-border px-2 py-1.5 text-sm text-foreground hover:bg-accent"
						aria-label={t("composer.model")}
						aria-haspopup="menu"
						aria-expanded={modelOpen ? "true" : "false"}
						onclick={(event: MouseEvent) => {
							event.stopPropagation();
							modelOpen = !modelOpen;
						}}
					>
						<Text tag="span">{picked.short}</Text>
						<Icon size="sm" class="text-muted-foreground"><ChevronDown /></Icon>
					</Button>
					{#if modelOpen}
						<Stack
							class="absolute bottom-full left-0 z-20 mb-2 w-60 rounded-default border border-border bg-popover p-1 shadow-lg"
							role="menu"
							aria-label={t("composer.model")}
							onclick={(event: MouseEvent) => event.stopPropagation()}
						>
							{#each models as item (item.id)}
								<Button
									class={cn(
										"w-full justify-between rounded-default px-3 py-2 text-left text-sm hover:bg-accent",
										model === item.id ? "text-foreground" : "text-foreground"
									)}
									role="menuitemradio"
									aria-checked={model === item.id ? "true" : "false"}
									onclick={() => pickModel(item.id)}
								>
									<Text tag="span">{item.full}</Text>
									{#if model === item.id}
										<Icon size="sm"><Check /></Icon>
									{/if}
								</Button>
							{/each}
						</Stack>
					{/if}
				</Block>
			</Group>
			<Button
				type="submit"
				disabled={disabled}
				class="inline-flex size-8 items-center justify-center rounded-default bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
				aria-label={t("composer.send")}
			>
				<Icon size="sm"><ArrowUp /></Icon>
			</Button>
		</Group>
	</Form>
</Block>

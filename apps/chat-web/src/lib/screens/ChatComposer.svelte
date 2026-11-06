<script lang="ts">
	import ArrowUp from "@lucide/svelte/icons/arrow-up";
	import FileText from "@lucide/svelte/icons/file-text";
	import Plus from "@lucide/svelte/icons/plus";
	import X from "@lucide/svelte/icons/x";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Form from "../../ui/form/Form.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Label from "../../ui/label/Label.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Textarea from "../../ui/textarea/Textarea.svelte";
	import { t } from "../i18n/dictionary";

	let {
		disabled = false,
		onSend,
		draft = $bindable(""),
		runtimeStatus = null
	}: {
		disabled?: boolean;
		onSend: (text: string) => void | Promise<void>;
		draft?: string;
		runtimeStatus?: {
			mode: "live" | "mock" | "booting";
			capabilities: { liveModel?: boolean; live?: { requested?: boolean; model?: string }; mode?: string; runtime?: string; note?: string } | null;
			error: string | null;
			canDelete: boolean;
			lastRequestId: string | null;
		} | null;
	} = $props();

	const runtimeLabel = $derived.by(() => {
		if (!runtimeStatus) return "";
		const caps = runtimeStatus.capabilities;
		if (runtimeStatus.mode === "mock") return t("runtime.mockMode");
		if (caps?.liveModel) return t("runtime.liveModel");
		const mode = caps?.mode ?? "deterministic-test";
		return t("runtime.testHarness").replace("{mode}", mode);
	});

	let showDesign = $state(true);
	// There is no per-message model switch in Session. Reflect server configuration,
	// never imply selecting GPT/Claude/Gemini changes the running Grok agent.
	const configuredModel = $derived(runtimeStatus?.capabilities?.live?.model || "");
	const modelLabel = $derived(configuredModel || t("composer.modelGrok"));

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

</script>


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
				<Button
					class="inline-flex items-center gap-1 rounded-default border border-border px-2 py-1.5 text-sm text-foreground"
					aria-label={t("composer.model")}
					title={t("composer.modelServerConfigured")}
					disabled
				>
					<Text tag="span">{modelLabel}</Text>
				</Button>
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

<script lang="ts">
	import { onMount } from "svelte";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Form from "../../ui/form/Form.svelte";
	import Input from "../../ui/input/Input.svelte";
	import Label from "../../ui/label/Label.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Title from "../compose/Title.svelte";
	import { t } from "../i18n/dictionary";

	let { onClose }: { onClose: () => void } = $props();

	let name = $state("OpenRouter");
	let baseUrl = $state("https://openrouter.ai/api/v1");
	let modelId = $state("");
	let apiKey = $state("");
	let trusted = $state(false);
	let notice = $state("");

	onMount(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	function save(event: Event) {
		event.preventDefault();
		apiKey = "";
		notice = t("model.needsKeyAfterReload");
	}

	function test(event: Event) {
		event.preventDefault();
		notice = t("model.testUiOnly");
	}

	function forget() {
		apiKey = "";
		notice = t("model.needsKeyAfterReload");
	}
</script>

<Block class="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-4">
	<Button class="absolute inset-0 h-full w-full bg-transparent" aria-label={t("model.cancel")} onclick={onClose}>
		<Text tag="span" class="sr-only">{t("model.cancel")}</Text>
	</Button>
	<Form
		class="relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-default border border-border bg-card p-5 sm:rounded-default"
		role="dialog"
		aria-modal="true"
		aria-label={t("model.addTitle")}
		onsubmit={save}
	>
		<Stack class="gap-4">
			<Title as={2} class="text-base font-semibold text-foreground">{t("model.addTitle")}</Title>
			<Text tag="p" class="text-sm text-muted-foreground">{t("model.privacy1")}</Text>
			<Text tag="p" class="text-sm text-muted-foreground">{t("model.privacy2")}</Text>
			<Text tag="p" class="text-sm text-muted-foreground">{t("model.privacy3")}</Text>
			<Text tag="p" class="text-sm text-muted-foreground">{t("model.privacy4")}</Text>
			<Text tag="p" class="text-sm text-muted-foreground">{t("model.privacy5")}</Text>
			<Stack class="gap-2">
				<Label for="model-name">{t("model.providerName")}</Label>
				<Input
					id="model-name"
					name="provider"
					class="rounded-default border border-input bg-background px-3 py-2 text-sm"
					value={name}
					oninput={(event: Event) => (name = (event.currentTarget as HTMLInputElement).value)}
				/>
			</Stack>
			<Stack class="gap-2">
				<Label for="model-url">{t("model.baseUrl")}</Label>
				<Input
					id="model-url"
					name="baseUrl"
					class="rounded-default border border-input bg-background px-3 py-2 text-sm"
					value={baseUrl}
					oninput={(event: Event) => (baseUrl = (event.currentTarget as HTMLInputElement).value)}
				/>
			</Stack>
			<Stack class="gap-2">
				<Label for="model-id">{t("model.modelId")}</Label>
				<Input
					id="model-id"
					name="modelId"
					class="rounded-default border border-input bg-background px-3 py-2 text-sm"
					value={modelId}
					oninput={(event: Event) => (modelId = (event.currentTarget as HTMLInputElement).value)}
				/>
			</Stack>
			<Stack class="gap-2">
				<Label for="model-key">{t("model.apiKey")}</Label>
				<Input
					id="model-key"
					name="apiKey"
					type="password"
					autocomplete="off"
					class="rounded-default border border-input bg-background px-3 py-2 text-sm"
					value={apiKey}
					oninput={(event: Event) => (apiKey = (event.currentTarget as HTMLInputElement).value)}
				/>
			</Stack>
			<Button
				class="justify-start rounded-default border border-border px-3 py-2 text-left text-sm"
				aria-pressed={trusted ? "true" : "false"}
				onclick={() => (trusted = !trusted)}
			>
				<Text tag="span">{t("model.trust")}</Text>
			</Button>
			{#if notice}
				<Text tag="p" class="text-sm text-muted-foreground" role="status">{notice}</Text>
			{/if}
			<Group class="flex-wrap justify-end gap-2">
				<Button
					class="rounded-default border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
					onclick={onClose}
				>
					<Text tag="span">{t("model.cancel")}</Text>
				</Button>
				<Button
					class="rounded-default border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
					onclick={forget}
				>
					<Text tag="span">{t("model.forget")}</Text>
				</Button>
				<Button
					class="rounded-default border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
					onclick={test}
				>
					<Text tag="span">{t("model.test")}</Text>
				</Button>
				<Button
					type="submit"
					class="rounded-default bg-foreground px-3 py-1.5 text-sm text-background hover:bg-foreground/90"
				>
					<Text tag="span">{t("model.save")}</Text>
				</Button>
			</Group>
		</Stack>
	</Form>
</Block>

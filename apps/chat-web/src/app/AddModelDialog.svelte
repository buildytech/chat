<script lang="ts">
	import { onMount } from "svelte";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Form from "$registry/kit/ui/form/Form.svelte";
	import Input from "$registry/kit/ui/input/Input.svelte";
	import Label from "$registry/kit/ui/label/Label.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import Title from "$registry/compose/Title.svelte";
	import { t } from "$lib/i18n/dictionary";

	let { onClose }: { onClose: () => void } = $props();

	let name = $state("OpenRouter");
	let baseUrl = $state("https://openrouter.ai/api/v1");
	let modelId = $state("");
	let apiKey = $state("");
	let trusted = $state(false);
	let notice = $state("");

	onMount(() => {
		const trigger = document.getElementById("composer-model-trigger");
		const dialog = document.querySelector<HTMLElement>('[data-slot="add-model-dialog"]');
		dialog?.querySelector<HTMLInputElement>("input")?.focus();
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			}
			if (event.key === "Tab" && dialog) {
				const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
				const first = controls[0];
				const last = controls.at(-1);
				if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
				else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
			}
		}
		window.addEventListener("keydown", onKey);
		return () => { window.removeEventListener("keydown", onKey); trigger?.focus(); };
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
		class="relative z-10 max-h-full w-full max-w-lg overflow-y-auto rounded-t-xl border border-border bg-card p-4 sm:rounded"
		role="dialog"
		data-slot="add-model-dialog"
		aria-modal="true"
		aria-label={t("model.addTitle")}
		onsubmit={save}
	>
		<Stack align="stretch" class="gap-4">
			<Title as={2} class="text-base font-semibold text-foreground">{t("model.addTitle")}</Title>
			<Text tag="p" class="text-sm text-muted-foreground">{t("model.privacy1")}</Text>
			<Text tag="p" class="text-sm text-muted-foreground">{t("model.privacy2")}</Text>
			<Text tag="p" class="text-sm text-muted-foreground">{t("model.privacy3")}</Text>
			<Text tag="p" class="text-sm text-muted-foreground">{t("model.privacy4")}</Text>
			<Text tag="p" class="text-sm text-muted-foreground">{t("model.privacy5")}</Text>
			<Stack align="stretch" class="gap-2">
				<Label for="model-name">{t("model.providerName")}</Label>
				<Input
					id="model-name"
					name="provider"
					class="rounded border border-input bg-background px-3 py-2 text-sm"
					value={name}
					oninput={(event: Event) => (name = (event.currentTarget as HTMLInputElement).value)}
				/>
			</Stack>
			<Stack align="stretch" class="gap-2">
				<Label for="model-url">{t("model.baseUrl")}</Label>
				<Input
					id="model-url"
					name="baseUrl"
					class="rounded border border-input bg-background px-3 py-2 text-sm"
					value={baseUrl}
					oninput={(event: Event) => (baseUrl = (event.currentTarget as HTMLInputElement).value)}
				/>
			</Stack>
			<Stack align="stretch" class="gap-2">
				<Label for="model-id">{t("model.modelId")}</Label>
				<Input
					id="model-id"
					name="modelId"
					class="rounded border border-input bg-background px-3 py-2 text-sm"
					value={modelId}
					oninput={(event: Event) => (modelId = (event.currentTarget as HTMLInputElement).value)}
				/>
			</Stack>
			<Stack align="stretch" class="gap-2">
				<Label for="model-key">{t("model.apiKey")}</Label>
				<Input
					id="model-key"
					name="apiKey"
					type="password"
					autocomplete="off"
					class="rounded border border-input bg-background px-3 py-2 text-sm"
					value={apiKey}
					oninput={(event: Event) => (apiKey = (event.currentTarget as HTMLInputElement).value)}
				/>
			</Stack>
			<Button
				class="justify-start rounded border border-border px-3 py-2 text-left text-sm"
				pressed={trusted}
				onclick={() => (trusted = !trusted)}
			>
				<Text tag="span">{t("model.trust")}</Text>
			</Button>
			{#if notice}
				<Text tag="p" class="text-sm text-muted-foreground" role="status">{notice}</Text>
			{/if}
			<Group class="flex-wrap justify-end gap-2">
				<Button
					class="rounded border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
					onclick={onClose}
				>
					<Text tag="span">{t("model.cancel")}</Text>
				</Button>
				<Button
					class="rounded border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
					onclick={forget}
				>
					<Text tag="span">{t("model.forget")}</Text>
				</Button>
				<Button
					class="rounded border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
					onclick={test}
				>
					<Text tag="span">{t("model.test")}</Text>
				</Button>
				<Button
					type="submit"
					class="rounded bg-foreground px-3 py-2 text-sm text-background hover:bg-foreground/90"
				>
					<Text tag="span">{t("model.save")}</Text>
				</Button>
			</Group>
		</Stack>
	</Form>
</Block>
